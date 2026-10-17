import { BunHttpServer } from '@effect/platform-bun';
import { Config, Effect, Layer, Option, Schema } from 'effect';
import { HttpClient, HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { renderSVG } from 'uqr';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Page } from './Page.js';
import { Paths } from './Paths.js';
import { Terminal } from './Terminal.js';
import { Tools } from './Tools.js';
import { Updates } from './Updates.js';

/** The port `opencode/config.yaml` gives the Supervisor for ingress. */
export const port = 8099;

const SelfInfo = Schema.Struct({
  data: Schema.Struct({
    network: Schema.optional(
      Schema.NullOr(Schema.Record(Schema.String, Schema.NullOr(Schema.Number)))
    ),
  }),
});

const failed = (error: { readonly message: string }) =>
  Effect.logWarning(error.message).pipe(
    Effect.as(HttpServerResponse.jsonUnsafe({ error: error.message }, { status: 500 }))
  );

/** The address the browser reached Home Assistant at, which OpenCode's port shares on your network. */
const PairRequest = Schema.Struct({
  host: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9.:[\]-]+$/)),
});

const TerminalPath = Schema.Struct({ kind: Terminal.Kind });

/** The terminal's size comes with the socket, so it starts at the page's size. */
const TerminalOpen = Schema.Struct({
  kind: Terminal.Kind,
  cols: Schema.NumberFromString.pipe(Schema.decodeTo(Terminal.Size.fields.cols)),
  rows: Schema.NumberFromString.pipe(Schema.decodeTo(Terminal.Size.fields.rows)),
});

/** The host port the network option maps OpenCode to, if any, for links on your network. */
const hostPort = Effect.gen(function* () {
  const http = yield* HttpClient.HttpClient;
  const token = yield* Config.String('SUPERVISOR_TOKEN').pipe(Config.option);

  return yield* Option.match(token, {
    onNone: () => Effect.succeed<number | null>(OpenCodeServer.port),
    onSome: (value) =>
      http
        .get('http://supervisor/addons/self/info', {
          headers: { authorization: `Bearer ${value}` },
        })
        .pipe(
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(SelfInfo)),
          Effect.map((info) => info.data.network?.[`${OpenCodeServer.port}/tcp`] ?? null),
          Effect.catch((error) =>
            Effect.logWarning(`Couldn't read the app's ports: ${error.message}`).pipe(
              Effect.as(null)
            )
          )
        ),
  });
});

/** Only the Supervisor, which proxies ingress for signed-in Home Assistant users, may use the page. */
const ingressGuard =
  (supervisor: string) =>
  <E, R>(httpEffect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      Option.exists(
        request.remoteAddress,
        (remote) => remote === supervisor || remote === `::ffff:${supervisor}`
      )
        ? httpEffect
        : Effect.succeed(HttpServerResponse.empty({ status: 403 }))
    );

const routes = Layer.mergeAll(
  HttpRouter.add('GET', '/', HttpServerResponse.html(Page.html)),
  HttpRouter.add(
    'GET',
    '/api/status',
    Effect.gen(function* () {
      const server = yield* OpenCodeServer.Service;
      const tools = yield* Tools.Service;
      const running = yield* server.info.pipe(Effect.option);
      const installed = yield* tools.serverOpenCode.pipe(Effect.option);

      return HttpServerResponse.jsonUnsafe({
        running: Option.getOrNull(Option.map(running, (current) => current.version)),
        remoteUrl: Option.getOrNull(
          Option.flatMapNullishOr(running, (current) => current.remoteUrl)
        ),
        installed: Option.getOrNull(Option.map(installed, (openCode) => openCode.version)),
        hostPort: yield* hostPort,
        warnings: yield* tools.warnings,
      });
    })
  ),
  HttpRouter.add(
    'POST',
    '/api/pair',
    Effect.gen(function* () {
      const server = yield* OpenCodeServer.Service;
      const { host } = yield* HttpServerRequest.schemaBodyJson(PairRequest);
      const port = yield* hostPort;
      const remoteUrl = yield* server.info.pipe(Effect.map((info) => info.remoteUrl));
      const pair = yield* server.pair;

      // Remote first: it works from anywhere, and clients keep the first address that answers.
      const urls = [
        ...(remoteUrl === undefined ? [] : [{ kind: 'remote', url: remoteUrl }]),
        ...(port === null ? [] : [{ kind: 'local', url: `http://${host}:${port}` }]),
      ];

      return HttpServerResponse.jsonUnsafe({
        expiresIn: pair.expiresIn,
        links: urls.map(({ kind, url }) => ({
          kind,
          url: new URL(`/auth/connect/${pair.code}`, url).href,
        })),
        // The same payload `opencode pair` puts in its QR code, which OpenCode's apps scan.
        qr: renderSVG(JSON.stringify({ code: pair.code, urls: urls.map(({ url }) => url) }), {
          border: 2,
        }),
      });
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'POST',
    '/api/update',
    Effect.gen(function* () {
      const updates = yield* Updates.Service;

      return HttpServerResponse.jsonUnsafe(yield* updates.checkAndRestart);
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'GET',
    '/terminal.js',
    Effect.gen(function* () {
      const paths = yield* Paths.Service;

      return yield* HttpServerResponse.file(`${paths.web}/terminal.js`, {
        contentType: 'text/javascript',
      });
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'GET',
    '/api/terminal/:kind',
    Effect.gen(function* () {
      const terminal = yield* Terminal.Service;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { kind, ...size } = yield* HttpRouter.schemaParams(TerminalOpen);
      const socket = yield* request.upgrade;

      yield* terminal.attach(kind, size, socket);

      return HttpServerResponse.empty();
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'POST',
    '/api/terminal/:kind/size',
    Effect.gen(function* () {
      const terminal = yield* Terminal.Service;
      const { kind } = yield* HttpRouter.schemaPathParams(TerminalPath);
      const size = yield* HttpServerRequest.schemaBodyJson(Terminal.Size);

      yield* terminal.resize(kind, size);

      return HttpServerResponse.empty({ status: 204 });
    }).pipe(Effect.catch(failed))
  )
);

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const supervisor = yield* Config.String('OPENCODE_APP_INGRESS_FROM').pipe(
      Config.withDefault('172.30.32.2')
    );

    return HttpRouter.serve(routes, { middleware: ingressGuard(supervisor) }).pipe(
      Layer.provide(BunHttpServer.layer({ hostname: '0.0.0.0', port }))
    );
  })
);

export * as Ingress from './Ingress.js';
