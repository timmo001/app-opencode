import { BunHttpServer } from '@effect/platform-bun';
import { Effect, FileSystem, Layer } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Paths } from './Paths.js';
import { Updates } from './Updates.js';

const failed = (error: { readonly message: string }) =>
  Effect.logWarning(error.message).pipe(
    Effect.as(HttpServerResponse.jsonUnsafe({ error: error.message }, { status: 500 }))
  );

/**
 * What the OpenCode plugin's `/app-update` command calls. It updates first and restarts as a second
 * call, so the plugin can write the result into the session before OpenCode stops.
 */
const routes = Layer.mergeAll(
  HttpRouter.add(
    'POST',
    '/update',
    Effect.gen(function* () {
      const updates = yield* Updates.Service;
      const result = yield* updates.check;

      return HttpServerResponse.jsonUnsafe({
        ...result,
        restartNeeded: Updates.openCodeChanged(result),
      });
    }).pipe(Effect.catch(failed))
  ),
  HttpRouter.add(
    'POST',
    '/restart',
    Effect.gen(function* () {
      const server = yield* OpenCodeServer.Service;

      // Answered before the restart, which stops the OpenCode that asked.
      yield* server.restart.pipe(
        Effect.delay('1 second'),
        Effect.catch((error) => Effect.logError(error.message)),
        Effect.forkDetach
      );

      return HttpServerResponse.empty({ status: 202 });
    })
  )
);

/** Serves the control routes on a socket only processes in the container can reach. */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Paths.Service;

    yield* fs.remove(paths.controlSocket).pipe(Effect.ignore);

    return HttpRouter.serve(routes, { disableListenLog: true }).pipe(
      Layer.provide(BunHttpServer.layer({ unix: paths.controlSocket }))
    );
  })
);

export * as Control from './Control.js';
