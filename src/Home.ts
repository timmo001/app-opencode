import { Effect, FileSystem } from 'effect';
import { Paths } from './Paths.js';

const agentsFile = `# OpenCode in Home Assistant

You are running in the OpenCode app for Home Assistant, in a Debian container.

- Home Assistant's configuration is at \`/homeassistant\`, and its shared folder at \`/share\`.
- Your home folder is \`$HOME\` (\`/data/home\`). It's kept across restarts and in the app's backups, so keep projects there.
- Developer tools come from mise. Add one for yourself with \`mise use -g <tool>\`, or for a project in its own \`mise.toml\`.
- This file and the rest of the app's OpenCode config are in the app's config folder, which the user can edit.
`;

const openCodeConfig = `{
  "$schema": "https://opencode.ai/config.json"
}
`;

const miseConfig = `# Your own tools, on top of the ones the app comes with. The agent adds to this
# file with \`mise use -g <tool>\`. See https://mise.jdx.dev/configuration.html
[tools]
`;

/**
 * Prepares the home folder before OpenCode runs. Your own config lives in the
 * app's config folder, so you can edit it with the File editor or Samba apps,
 * and is linked into place on every start.
 */
export const prepare = Effect.fn('Home.prepare')(function* () {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Paths.Service;
  const openCodeDir = `${paths.home}/.config/opencode`;
  const miseDir = `${paths.home}/.config/mise`;

  for (const dir of [paths.config, paths.state, `${openCodeDir}/plugins`, `${miseDir}/conf.d`]) {
    yield* fs.makeDirectory(dir, { recursive: true });
  }

  // Created only when missing, so your edits are never overwritten.
  const seed = Effect.fn('Home.seed')(function* (file: string, content: string) {
    if (!(yield* fs.exists(file))) yield* fs.writeFileString(file, content);
  });

  yield* seed(`${paths.config}/AGENTS.md`, agentsFile);
  yield* seed(`${paths.config}/opencode.json`, openCodeConfig);
  yield* seed(`${paths.config}/mise.toml`, miseConfig);

  if (!(yield* fs.exists(`${paths.config}/skills`))) {
    yield* fs.makeDirectory(`${paths.config}/skills`);
  }

  // Remade on every start. A real file in the way is left alone, with a warning.
  const link = Effect.fn('Home.link')(function* (target: string, path: string) {
    const isLink = yield* fs.readLink(path).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );

    if (isLink) {
      yield* fs.remove(path);
    } else if (yield* fs.exists(path)) {
      return yield* Effect.logWarning(`${path} is a real file, so ${target} isn't linked there`);
    }

    yield* fs.symlink(target, path);
  });

  // service.json, which holds the server password and tunnel route, isn't linked, so it stays in /data.
  for (const name of ['opencode.json', 'AGENTS.md', 'skills']) {
    yield* link(`${paths.config}/${name}`, `${openCodeDir}/${name}`);
  }

  yield* link(`${paths.config}/mise.toml`, `${miseDir}/config.toml`);

  // The app's own plugin, which adds /app-update. Linked from the image, so it always matches it.
  if (yield* fs.exists(paths.plugin)) {
    yield* link(paths.plugin, `${openCodeDir}/plugins/opencode-app.js`);
  }

  // A registration left by the last run names a PID that may now belong to
  // another process, and `opencode service set` signals that PID.
  yield* fs.remove(`${paths.home}/.local/state/opencode/service.json`).pipe(Effect.ignore);
});

export * as Home from './Home.js';
