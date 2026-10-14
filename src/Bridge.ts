import { Context, Effect, Exit, FileSystem, Layer, Queue, Scope, SynchronizedRef } from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';
import { Log } from './Log.js';
import { Options } from './Options.js';
import { Paths } from './Paths.js';
import { Tools } from './Tools.js';

/** The tool `image/mise.toml` installs ha-bridge as. */
export const tool = 'github:timmo001/ha-bridge';

export interface Interface {
  /** Stops ha-bridge and starts the version the system config resolves to now. */
  readonly restart: Effect.Effect<void>;
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Bridge') {}

/** Whether an update installed a new ha-bridge. */
export const changed = (result: Tools.UpgradeResult) =>
  result.updated.some((update) => update.tool === tool);

/**
 * Runs `ha-bridge serve`, which keeps one Home Assistant connection for every `ha-bridge` command.
 * With no config file and `SUPERVISOR_TOKEN` set, it connects through the Supervisor by itself.
 */
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const paths = yield* Paths.Service;
    const options = yield* Options.Service;
    const tools = yield* Tools.Service;

    if (options.ha_bridge === false) {
      return Service.of({ restart: Effect.void });
    }

    const crashed = yield* Queue.unbounded<void>();

    // The skills come in the release with the binary, so they always match it. Releases from
    // before they did have none.
    const linkSkills = Effect.fn('Bridge.linkSkills')(function* (installPath: string) {
      const skills = `${installPath}/skills`;

      yield* fs.remove(paths.bridgeSkills).pipe(Effect.ignore);

      if (yield* fs.exists(skills)) {
        yield* fs.symlink(skills, paths.bridgeSkills);
      }
    });

    const start = Effect.gen(function* () {
      const bridge = yield* tools.systemTool(tool, 'ha-bridge');

      yield* linkSkills(bridge.installPath);
      yield* Log.step(`Starting ha-bridge ${bridge.version}`);

      const scope = yield* Scope.make();
      yield* Scope.addFinalizer(scope, Effect.logInfo('ha-bridge stopped'));

      const handle = yield* spawner
        .spawn(
          ChildProcess.make(bridge.path, ['serve'], {
            cwd: paths.home,
            extendEnv: true,
            env: { HA_BRIDGE_SOCK: paths.bridgeSocket },
            stdout: 'inherit',
            stderr: 'inherit',
          })
        )
        .pipe(Scope.provide(scope));

      yield* handle.exitCode.pipe(
        Effect.flatMap((code) => Effect.logError(`ha-bridge stopped with exit code ${code}`)),
        Effect.andThen(Queue.offer(crashed, undefined)),
        Effect.ignore,
        Effect.forkIn(scope)
      );

      return scope;
    }).pipe(
      // OpenCode doesn't need it, so the app starts without it.
      Effect.catch((error) =>
        Effect.logWarning(`ha-bridge couldn't start: ${error.message}`).pipe(Effect.as(undefined))
      )
    );

    const stop = (scope: Scope.Closeable | undefined) =>
      scope === undefined ? Effect.void : Scope.close(scope, Exit.void);

    const running = yield* SynchronizedRef.make(yield* start);

    yield* Effect.addFinalizer(() => SynchronizedRef.get(running).pipe(Effect.flatMap(stop)));

    const restart = SynchronizedRef.updateEffect(running, (current) =>
      stop(current).pipe(Effect.andThen(start))
    ).pipe(Effect.withSpan('Bridge.restart'));

    yield* Queue.take(crashed).pipe(
      Effect.andThen(Effect.sleep('5 seconds')),
      Effect.andThen(restart),
      Effect.forever,
      Effect.forkScoped
    );

    return Service.of({ restart });
  })
);

export * as Bridge from './Bridge.js';
