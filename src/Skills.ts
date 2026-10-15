import { Context, Effect, FileSystem, Layer } from 'effect';
import { Paths } from './Paths.js';
import { Tools } from './Tools.js';

/** The tool `image/mise.toml` installs triage as. */
export const triageTool = 'github:timmo001/triage';

export interface Interface {
  /** Links the installed triage's skills again, such as after an update changed it. */
  readonly linkTriage: Effect.Effect<void>;
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Skills') {}

/** Whether an update installed a new triage. */
export const triageChanged = (result: Tools.UpgradeResult) =>
  result.updated.some((update) => update.tool === triageTool);

/**
 * Links a tool's skills into OpenCode's system skills folder. They come in its release with the
 * binary, so they always match it. Releases from before they did have none, and get no link.
 */
export const link = Effect.fn('Skills.link')(function* (installPath: string, target: string) {
  const fs = yield* FileSystem.FileSystem;
  const skills = `${installPath}/skills`;

  yield* fs.remove(target).pipe(Effect.ignore);

  if (yield* fs.exists(skills)) {
    yield* fs.symlink(skills, target);
  }
});

/** Links triage's skills, such as `triage-resolve`, for its MCP server through Home Assistant. */
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Paths.Service;
    const tools = yield* Tools.Service;

    const linkTriage = tools.systemTool(triageTool, 'triage').pipe(
      Effect.flatMap((triage) => link(triage.installPath, paths.triageSkills)),
      Effect.provideService(FileSystem.FileSystem, fs),
      // OpenCode doesn't need them, so the app starts without them.
      Effect.catch((error) => Effect.logWarning(`Couldn't link triage's skills: ${error.message}`)),
      Effect.withSpan('Skills.linkTriage')
    );

    yield* linkTriage;

    return Service.of({ linkTriage });
  })
);

export * as Skills from './Skills.js';
