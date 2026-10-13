import { OpenCode } from '@opencode/client/effect';
import { Service as OpenCodeService } from '@opencode/client/effect/service';
import {
  Context,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Queue,
  Schedule,
  Schema,
  Scope,
  SynchronizedRef,
} from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/http';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';
import { Command } from './Command.js';
import { Log } from './Log.js';
import { Options } from './Options.js';
import { Paths } from './Paths.js';
import { Tools } from './Tools.js';

/** The port OpenCode's service listens on, which `opencode/config.yaml` maps to the host. */
export const port = 49374;

export interface PairCode {
  readonly code: string;
  readonly expiresIn: number;
}

export interface Info {
  readonly version: string;
  /** The OpenTunnel address, when remote access is on and the tunnel is up. */
  readonly remoteUrl: string | undefined;
}

export interface Interface {
  /** A one-time code that signs a browser in to OpenCode at `/auth/connect/<code>`. */
  readonly pair: Effect.Effect<PairCode, OpenCodeServerError>;
  /** What the running server reports about itself. */
  readonly info: Effect.Effect<Info, OpenCodeServerError>;
  /** Stops the server and starts the OpenCode the system config resolves to now. */
  readonly restart: Effect.Effect<void, OpenCodeServerError>;
}

export class OpenCodeServerError extends Schema.TaggedError<OpenCodeServerError>()(
  'OpenCodeServerError',
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  }
) {
  override get message() {
    return `${this.operation} failed: ${String(this.cause)}`;
  }
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/OpenCodeServer') {}

type Client = Effect.Success<ReturnType<typeof OpenCode.make>>;

interface Running {
  readonly scope: Scope.Closeable;
  readonly client: Client;
}

const serverError = (operation: string) =>
  Effect.mapError((cause: unknown) => new OpenCodeServerError({ operation, cause }));

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const http = yield* HttpClient.HttpClient;
    const paths = yield* Paths.Service;
    const options = yield* Options.Service;
    const tools = yield* Tools.Service;
    const crashed = yield* Queue.unbounded<void>();
    const registration = `${paths.home}/.local/state/opencode/service.json`;
    const passwordMarker = `${paths.data}/server-password-set`;

    const opencode = (path: string, args: ReadonlyArray<string>) =>
      Command.run(path, args, { cwd: paths.home, extendEnv: true }).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );

    // Settings go through `opencode service set`, so OpenCode owns service.json and its format.
    const configure = Effect.fn('OpenCodeServer.configure')(function* (path: string) {
      yield* opencode(path, ['service', 'set', 'hostname', '0.0.0.0']);
      yield* opencode(path, ['service', 'set', 'port', String(port)]);

      if (options.server_password !== undefined && options.server_password !== '') {
        yield* opencode(path, ['service', 'set', 'password', options.server_password]);
        yield* fs.writeFileString(passwordMarker, '');
      } else if (yield* fs.exists(passwordMarker)) {
        // Back to a password of OpenCode's own, which only pairing uses.
        yield* opencode(path, ['service', 'unset', 'password']);
        yield* fs.remove(passwordMarker);
      }

      // Turning it on creates the tunnel's identity, which needs the internet. Without it OpenCode
      // still runs, on the network only.
      yield* opencode(path, ['service', 'set', 'remote', String(options.remote_access)]).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`Remote access couldn't be turned on: ${error.message}`)
        )
      );
    });

    const connect = Effect.gen(function* () {
      const endpoint = yield* OpenCodeService.discover({ file: registration }).pipe(
        Effect.flatMap(Effect.fromNullishOr),
        Effect.retry(Schedule.spaced('500 millis').pipe(Schedule.upTo({ times: 120 })))
      );

      const headers = OpenCodeService.headers(
        endpoint.auth === undefined
          ? { url: endpoint.url }
          : { url: endpoint.url, auth: endpoint.auth }
      );

      const client =
        headers === undefined
          ? http
          : HttpClient.mapRequest(http, HttpClientRequest.setHeaders(headers));

      return yield* OpenCode.make({ baseUrl: endpoint.url }).pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
    }).pipe(Effect.provideService(FileSystem.FileSystem, fs));

    const start = Effect.gen(function* () {
      const server = yield* tools.serverOpenCode;

      yield* configure(server.path);
      yield* fs.remove(registration).pipe(Effect.ignore);
      yield* Log.step(`Starting OpenCode ${server.version}`);

      const scope = yield* Scope.make();
      // Added first, so it runs last, once the process has gone.
      yield* Scope.addFinalizer(scope, Effect.logInfo('OpenCode stopped'));

      const handle = yield* spawner
        .spawn(
          ChildProcess.make(server.path, ['serve', '--service'], {
            cwd: paths.home,
            extendEnv: true,
            env: { OPENCODE_APP_CONTROL_SOCKET: paths.controlSocket },
            stdout: 'inherit',
            stderr: 'inherit',
          })
        )
        .pipe(Scope.provide(scope));

      // Interrupted first when the scope closes, so a restart isn't taken for a crash.
      yield* handle.exitCode.pipe(
        Effect.flatMap((code) => Effect.logError(`OpenCode stopped with exit code ${code}`)),
        Effect.andThen(Queue.offer(crashed, undefined)),
        Effect.ignore,
        Effect.forkIn(scope)
      );

      const client = yield* connect.pipe(Effect.onError(() => Scope.close(scope, Exit.void)));

      return { scope, client } satisfies Running;
    }).pipe(serverError('Starting OpenCode'));

    const running = yield* SynchronizedRef.make<Running>(yield* start);

    yield* Effect.addFinalizer(() =>
      SynchronizedRef.get(running).pipe(
        Effect.flatMap((current) => Scope.close(current.scope, Exit.void))
      )
    );

    const restart = SynchronizedRef.updateEffect(running, (current) =>
      Scope.close(current.scope, Exit.void).pipe(Effect.andThen(start))
    ).pipe(Effect.withSpan('OpenCodeServer.restart'));

    // A crash restarts the server after a pause, so a broken update can't spin.
    yield* Queue.take(crashed).pipe(
      Effect.andThen(Effect.sleep('5 seconds')),
      Effect.andThen(restart),
      Effect.catch((error) => Effect.logError(error.message)),
      Effect.forever,
      Effect.forkScoped
    );

    const withClient = <A, E>(operation: string, use: (client: Client) => Effect.Effect<A, E>) =>
      SynchronizedRef.get(running).pipe(
        Effect.flatMap((current) => use(current.client)),
        serverError(operation)
      );

    const pair = withClient('Pairing', (client) => client.server.pair()).pipe(
      Effect.map((code) => ({ code: code.code, expiresIn: code.expires_in }))
    );

    const info = withClient('Reading the server info', (client) => client.server.info()).pipe(
      Effect.map((server) => ({
        version: server.version,
        remoteUrl: server.urls.find((url) => url.startsWith('https:')),
      }))
    );

    return Service.of({ pair, info, restart });
  })
);

export * as OpenCodeServer from './OpenCodeServer.js';
