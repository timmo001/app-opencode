import { BunHttpServer } from '@effect/platform-bun';
import { Config, Effect, Layer, Option, Schema } from 'effect';
import { HttpClient, HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Page } from './Page.js';
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
      const http = yield* HttpClient.HttpClient;
      const token = yield* Config.String('SUPERVISOR_TOKEN').pipe(Config.option);

      // The host port the network option maps OpenCode to, if any, for links on your network.
      const hostPort = yield* Option.match(token, {
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

      const running = yield* server.info.pipe(Effect.option);
      const installed = yield* tools.serverOpenCode.pipe(Effect.option);

      return HttpServerResponse.jsonUnsafe({
        running: Option.getOrNull(Option.map(running, (current) => current.version)),
        remoteUrl: Option.getOrNull(
          Option.flatMapNullishOr(running, (current) => current.remoteUrl)
        ),
        installed: Option.getOrNull(Option.map(installed, (openCode) => openCode.version)),
        hostPort,
        warnings: yield* tools.warnings,
      });
    })
  ),
  HttpRouter.add(
    'POST',
    '/api/pair',
    Effect.gen(function* () {
      const server = yield* OpenCodeServer.Service;

      return HttpServerResponse.jsonUnsafe(yield* server.pair);
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'POST',
    '/api/update',
    Effect.gen(function* () {
      const updates = yield* Updates.Service;

      return HttpServerResponse.jsonUnsafe(yield* updates.checkAndRestart);
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
