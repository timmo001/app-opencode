import { Config, Context, Effect, FileSystem, Layer, Ref, Schema, Semaphore } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { Command } from './Command.js';
import { Log } from './Log.js';
import { Options } from './Options.js';
import { Paths } from './Paths.js';

/** The npm package OpenCode 2 is published as, which `image/mise.toml` lists. */
export const openCodeTool = 'npm:@opencode/cli';

export interface Update {
  readonly tool: string;
  readonly from: string | undefined;
  readonly to: string;
}

export interface UpgradeResult {
  readonly updated: ReadonlyArray<Update>;
  readonly failed: ReadonlyArray<string>;
  /** The server's OpenCode version before and after, from the system config. */
  readonly openCode: { readonly before: string; readonly after: string };
}

export interface SystemTool {
  readonly path: string;
  readonly version: string;
  /** The version's install folder. */
  readonly installPath: string;
}

export type ServerOpenCode = SystemTool;

export interface Interface {
  /** Installs the `tools` option. Never fails: a bad entry is a warning. */
  readonly applyOptions: Effect.Effect<void>;
  /** Installs the `system_packages` option, which takes minutes. Never fails: a bad entry is a warning. */
  readonly installPackages: Effect.Effect<void>;
  /** Installs the newest version each built-in and global tool allows, one upgrade at a time. */
  readonly upgrade: Effect.Effect<UpgradeResult, ToolsError>;
  /** The OpenCode the server runs, resolved from the system config alone, so your layers can't change it. */
  readonly serverOpenCode: Effect.Effect<ServerOpenCode, ToolsError>;
  /** A built-in tool's command, resolved from the system config alone like the server's OpenCode. */
  readonly systemTool: (tool: string, command: string) => Effect.Effect<SystemTool, ToolsError>;
  /** Entries from the options that couldn't be installed, for the sidebar page. */
  readonly warnings: Effect.Effect<ReadonlyArray<string>>;
}

export class ToolsError extends Schema.TaggedError<ToolsError>()('ToolsError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message() {
    return `${this.operation} failed: ${String(this.cause)}`;
  }
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Tools') {}

const Outdated = Schema.fromJsonString(
  Schema.Record(
    Schema.String,
    Schema.Struct({
      current: Schema.optional(Schema.NullOr(Schema.String)),
      latest: Schema.String,
    })
  )
);

/** `mise ls --installed --json`: every installed version, in your home and the image, by tool. */
const Installed = Schema.fromJsonString(
  Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        version: Schema.String,
        install_path: Schema.String,
        active: Schema.optional(Schema.Boolean),
      })
    )
  )
);

/** Splits a `tools` entry, `[backend:]name[@version]`, keeping the `@` of a scoped npm name. */
export const parseTool = (entry: string) => {
  const at = entry.lastIndexOf('@');

  return at > 0 && entry[at - 1] !== ':'
    ? { name: entry.slice(0, at), version: entry.slice(at + 1) }
    : { name: entry, version: 'latest' };
};

const toolsError = (operation: string) =>
  Effect.mapError((cause: unknown) => new ToolsError({ operation, cause }));

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const paths = yield* Paths.Service;
    const options = yield* Options.Service;

    const systemConfig = yield* Config.String('MISE_SYSTEM_CONFIG_DIR').pipe(
      Config.withDefault('/etc/mise')
    );

    const systemData = yield* Config.String('MISE_SYSTEM_DATA_DIR').pipe(
      Config.withDefault('/usr/local/share/mise')
    );

    const warningsRef = yield* Ref.make<ReadonlyArray<string>>([]);
    const upgrades = yield* Semaphore.make(1);
    const optionsFile = `${paths.home}/.config/mise/conf.d/app-options.toml`;

    const warn = (message: string) =>
      Ref.update(warningsRef, (all) => [...all, message]).pipe(
        Effect.andThen(Effect.logWarning(message))
      );

    // Run from an empty folder of the app's own, so no project's mise.toml is in effect.
    const mise = (args: ReadonlyArray<string>, env: Record<string, string> = {}, log = false) =>
      Command.run('mise', args, {
        cwd: paths.state,
        extendEnv: true,
        env: { MISE_YES: '1', ...env },
        log,
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

    // Only the system config: the global config is pointed at it too, so your layers aren't read.
    const systemOnly = {
      MISE_CONFIG_DIR: systemConfig,
      MISE_GLOBAL_CONFIG_FILE: `${systemConfig}/config.toml`,
    };

    const systemTool = (tool: string, command: string) =>
      Effect.gen(function* () {
        const which = yield* mise(['which', command], systemOnly);
        const current = yield* mise(['current', tool], systemOnly);
        const where = yield* mise(['where', tool], systemOnly);

        return {
          path: which.stdout.trim(),
          version: current.stdout.trim(),
          installPath: where.stdout.trim(),
        };
      }).pipe(toolsError(`Finding ${command}`));

    const serverOpenCode = systemTool(openCodeTool, 'opencode');

    const apt = (args: ReadonlyArray<string>) =>
      Command.run('apt-get', args, {
        extendEnv: true,
        env: { DEBIAN_FRONTEND: 'noninteractive' },
        log: true,
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

    const installPackages = Effect.gen(function* () {
      if (options.system_packages.length === 0) return;

      yield* Log.step(`Installing system packages: ${options.system_packages.join(', ')}`);
      yield* apt(['update']).pipe(
        Effect.catch((error) => warn(`Couldn't update the package lists: ${error.message}`))
      );

      let installed = 0;

      // One at a time, so a package that doesn't exist only skips itself.
      for (const name of options.system_packages) {
        yield* apt(['install', '-y', '--no-install-recommends', name]).pipe(
          Effect.andThen(Effect.sync(() => installed++)),
          Effect.catch((error) =>
            warn(
              `System package "${name}" couldn't be installed. Check the name on packages.debian.org. ${error.message}`
            )
          )
        );
      }

      yield* Effect.logInfo(
        `Installed ${installed} of ${options.system_packages.length} system packages`
      );
    });

    // Read without the network. A failure only means everything is installed as if it were new.
    const listInstalled = mise(['ls', '--installed', '--json']).pipe(
      Effect.flatMap(({ stdout }) => Schema.decodeUnknownEffect(Installed)(stdout)),
      Effect.orElseSucceed((): typeof Installed.Type => ({}))
    );

    const installTools = Effect.gen(function* () {
      const installed: Array<{ readonly name: string; readonly version: string }> = [];
      const present = yield* listInstalled;

      // The image comes with the default list, and a tool you've had before is kept in $HOME, so
      // only new entries are installed. Updates are left to the update check.
      const missing = options.tools.filter((entry) => {
        const tool = parseTool(entry);
        const versions = (present[tool.name] ?? []).map((install) => install.version);

        return tool.version === 'latest'
          ? versions.length === 0
          : !versions.some(
              (version) => version === tool.version || version.startsWith(`${tool.version}.`)
            );
      });

      if (missing.length > 0) {
        yield* Log.step(`Installing tools: ${missing.join(', ')}`);

        // All at once first, so mise installs what a tool's backend needs before it, such as uv
        // for pypi tools. A bad entry doesn't stop the rest, and the loop below finds it.
        yield* mise(
          [
            'install',
            ...missing.map((entry) => {
              const tool = parseTool(entry);

              return `${tool.name}@${tool.version}`;
            }),
          ],
          {},
          true
        ).pipe(Effect.ignore);
      }

      for (const entry of options.tools) {
        const tool = parseTool(entry);

        if (!missing.includes(entry)) {
          installed.push(tool);
          continue;
        }

        // Installed before it goes in the config, so an entry mise can't resolve never breaks it.
        yield* mise(['install', `${tool.name}@${tool.version}`], {}, true).pipe(
          Effect.andThen(Effect.sync(() => installed.push(tool))),
          Effect.catch((error) =>
            warn(
              `Tool "${entry}" couldn't be installed. Check it with \`mise registry\`. ${error.message}`
            )
          )
        );
      }

      if (missing.length > 0) {
        yield* Effect.logInfo(`Installed ${installed.length} of ${options.tools.length} tools`);
      }

      // Rewritten on every start, so removing a tool from the option removes it here.
      const lines = installed.map(
        (tool) => `${JSON.stringify(tool.name)} = ${JSON.stringify(tool.version)}`
      );

      const content = [
        '# Written by the app from its "tools" option on every start. Edit the option, not this file.',
        '[tools]',
        ...lines,
        '',
      ].join('\n');

      yield* fs
        .writeFileString(optionsFile, content)
        .pipe(Effect.catch((error) => warn(`Couldn't write ${optionsFile}: ${error.message}`)));
    });

    // A default tool you've taken off the list still has the image's copy, and its shim would make
    // it look installed, so it's removed. The image's filesystem is reset on every start anyway.
    const removeUnused = Effect.gen(function* () {
      const present = yield* listInstalled;

      for (const [name, installs] of Object.entries(present)) {
        const fromImage = installs.some((install) =>
          install.install_path.startsWith(`${systemData}/`)
        );

        if (!fromImage || installs.some((install) => install.active === true)) continue;

        yield* mise(['uninstall', '--all', name]).pipe(
          Effect.andThen(Effect.logInfo(`Removed ${name}, which isn't in the tools option`)),
          Effect.catch((error) => Effect.logWarning(`Couldn't remove ${name}: ${error.message}`))
        );
      }
    });

    const applyOptions = Effect.gen(function* () {
      yield* Ref.set(warningsRef, []);
      yield* installTools;
      yield* removeUnused;
      yield* mise(['reshim']).pipe(Effect.ignore);
      // Versions no config uses any more, such as ones replaced by an upgrade. Nothing runs from them yet.
      yield* mise(['prune', '--yes']).pipe(Effect.ignore);
    }).pipe(Effect.withSpan('Tools.applyOptions'));

    const upgrade = Effect.gen(function* () {
      yield* Log.step('Checking for tool updates');
      const before = yield* serverOpenCode;

      // `mise upgrade` would reinstall into the image's folder, which is lost on restart, so each newer
      // version is installed by name instead: that goes into $HOME, which is kept in /data.
      const { stdout } = yield* mise(['outdated', '--json']).pipe(
        toolsError('Checking for updates')
      );

      const outdated = yield* Schema.decodeUnknownEffect(Outdated)(stdout).pipe(
        toolsError('Reading mise outdated')
      );

      const updated: Array<Update> = [];
      const failed: Array<string> = [];

      for (const [tool, versions] of Object.entries(outdated)) {
        yield* mise(['install', `${tool}@${versions.latest}`], {}, true).pipe(
          Effect.andThen(
            Effect.sync(() =>
              updated.push({ tool, from: versions.current ?? undefined, to: versions.latest })
            )
          ),
          Effect.catch((error: Command.CommandError) =>
            Effect.sync(() => failed.push(tool)).pipe(
              Effect.andThen(Effect.logWarning(`Couldn't update ${tool}: ${error.message}`))
            )
          )
        );
      }

      if (updated.length > 0) yield* mise(['reshim']).pipe(Effect.ignore);

      const after = yield* serverOpenCode;

      yield* Effect.logInfo(
        updated.length === 0
          ? 'Tools are up to date'
          : `Updated ${updated.map((update) => `${update.tool} to ${update.to}`).join(', ')}`
      );

      return { updated, failed, openCode: { before: before.version, after: after.version } };
    }).pipe(Semaphore.withPermit(upgrades), Effect.withSpan('Tools.upgrade'));

    return Service.of({
      applyOptions,
      installPackages: installPackages.pipe(Effect.withSpan('Tools.installPackages')),
      upgrade,
      serverOpenCode,
      systemTool,
      warnings: Ref.get(warningsRef),
    });
  })
);

export * as Tools from './Tools.js';
