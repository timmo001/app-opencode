import { Context, Effect, Layer } from 'effect';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Tools } from './Tools.js';

export interface Interface {
  /** Updates the tools. OpenCode changing is reported, not acted on, so the caller can warn first. */
  readonly check: Effect.Effect<Tools.UpgradeResult, Tools.ToolsError>;
  /** Updates the tools, then restarts the server when its OpenCode changed. */
  readonly checkAndRestart: Effect.Effect<
    Tools.UpgradeResult,
    Tools.ToolsError | OpenCodeServer.OpenCodeServerError
  >;
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Updates') {}

export const openCodeChanged = (result: Tools.UpgradeResult) =>
  result.openCode.before !== result.openCode.after;

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const tools = yield* Tools.Service;
    const server = yield* OpenCodeServer.Service;

    const checkAndRestart = tools.upgrade.pipe(
      Effect.tap((result) => (openCodeChanged(result) ? server.restart : Effect.void))
    );

    // Every 12 hours the update is installed but OpenCode isn't restarted under you: the new version
    // runs from the next restart.
    yield* tools.upgrade.pipe(
      Effect.tap((result) =>
        openCodeChanged(result)
          ? Effect.logInfo(
              `OpenCode ${result.openCode.after} is installed, and runs after the next restart`
            )
          : Effect.void
      ),
      Effect.catch((error) => Effect.logWarning(error.message)),
      Effect.delay('12 hours'),
      Effect.forever,
      Effect.forkScoped
    );

    return Service.of({ check: tools.upgrade, checkAndRestart });
  })
);

export * as Updates from './Updates.js';
