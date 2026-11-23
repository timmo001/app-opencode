import { Config, Effect, Layer, Option, Schema } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';
import { OpenCodeServer } from './OpenCodeServer.js';

/** The service `opencode/config.yaml` lists, which the OpenCode integration discovers. */
const service = 'opencode';

const SelfInfo = Schema.Struct({
  data: Schema.Struct({ hostname: Schema.String }),
});

/**
 * Tells Home Assistant where OpenCode is, with a paired token, so the OpenCode integration offers
 * to add it without a pairing link. It runs on every start: the Supervisor only passes it on when
 * it changes, and the integration ignores it once the app is set up.
 */
const announce = Effect.fn('Discovery.announce')(function* (supervisorToken: string) {
  const http = yield* HttpClient.HttpClient;
  const server = yield* OpenCodeServer.Service;
  const headers = { authorization: `Bearer ${supervisorToken}` };

  const info = yield* http.get('http://supervisor/addons/self/info', { headers }).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(SelfInfo))
  );

  const token = yield* server.token;

  yield* HttpClientRequest.post('http://supervisor/discovery').pipe(
    HttpClientRequest.setHeaders(headers),
    HttpClientRequest.bodyJsonUnsafe({
      service,
      config: { host: info.data.hostname, port: OpenCodeServer.port, token },
    }),
    http.execute,
    Effect.flatMap(HttpClientResponse.filterStatusOk)
  );

  yield* Effect.logInfo('Home Assistant can now add OpenCode as an Assist agent');
});

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const supervisorToken = yield* Config.String('SUPERVISOR_TOKEN').pipe(Config.option);

    if (Option.isNone(supervisorToken)) {
      return;
    }

    yield* announce(supervisorToken.value).pipe(
      Effect.catch((error) =>
        Effect.logWarning(`Couldn't offer OpenCode to Home Assistant: ${error.message}`)
      ),
      Effect.forkScoped
    );
  })
);

export * as Discovery from './Discovery.js';
