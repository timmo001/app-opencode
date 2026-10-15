import { Context, Effect, Layer } from 'effect';
import { Bridge } from './Bridge.js';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Skills } from './Skills.js';
import { Tools } from './Tools.js';

export interface Interface {
  /**
   * Updates the tools and restarts ha-bridge when it changed. OpenCode changing is reported, not
   * acted on, so the caller can warn first.
   */
  readonly check: Effect.Effect<Tools.UpgradeResult, Tools.ToolsError>;
  /** Updates the tools, then restarts ha-bridge and the server when they changed. */
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
    const bridge = yield* Bridge.Service;
    const skills = yield* Skills.Service;

    // A new triage only needs its skills linked again, which is safe to do at any time.
    const relinkSkills = (result: Tools.UpgradeResult) =>
      Skills.triageChanged(result) ? skills.linkTriage : Effect.void;

    const check = tools.upgrade.pipe(
      Effect.tap(relinkSkills),
      Effect.tap((result) => (Bridge.changed(result) ? bridge.restart : Effect.void))
    );

    const checkAndRestart = check.pipe(
      Effect.tap((result) => (openCodeChanged(result) ? server.restart : Effect.void))
    );

    // Every 12 hours the update is installed but nothing is restarted under you: new versions of
    // OpenCode and ha-bridge run from the next restart.
    yield* tools.upgrade.pipe(
      Effect.tap(relinkSkills),
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

    return Service.of({ check, checkAndRestart });
  })
);

export * as Updates from './Updates.js';
