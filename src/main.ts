import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Cause, Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { Control } from './Control.js';
import { Home } from './Home.js';
import { Ingress } from './Ingress.js';
import { Log } from './Log.js';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Options } from './Options.js';
import { Paths } from './Paths.js';
import { Tools } from './Tools.js';
import { Updates } from './Updates.js';

/** Everything that has to be in place before OpenCode first starts. */
const startup = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service;

    yield* Home.prepare();
    yield* tools.applyOptions;
    yield* tools.upgrade.pipe(
      Effect.catch((error) =>
        Effect.logWarning(
          `Couldn't check for updates, so the installed tools are used: ${error.message}`
        )
      )
    );
  })
);

const app = Layer.mergeAll(Control.layer, Ingress.layer).pipe(
  Layer.provideMerge(Updates.layer),
  Layer.provideMerge(OpenCodeServer.layer),
  Layer.provideMerge(startup),
  Layer.provideMerge(Tools.layer),
  Layer.provideMerge(Options.layer),
  Layer.provideMerge(Paths.layer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(BunServices.layer)
);

BunRuntime.runMain(
  Layer.launch(app).pipe(
    Effect.tapCause((cause) =>
      Cause.hasInterruptsOnly(cause) ? Effect.void : Effect.logError('The app stopped:', cause)
    ),
    Effect.provide(Log.layer)
  ),
  { disableErrorReporting: true }
);
