import { Plugin } from '@opencode/plugin/effect';
import { Effect, Result, Schema } from 'effect';

/**
 * Adds `/app-update`, which asks the app to update OpenCode and the built-in tools, reports what
 * changed in the session, then has the app restart OpenCode when it changed. `/app-feedback` has
 * the agent draft an issue for the app and open it once you confirm. Every session also gets a
 * short note on the app's environment, which points to the app's skills for the rest.
 *
 * Bundled with `effect` and `@opencode/plugin` left external, so it uses OpenCode's own copies.
 */

const environment = [
  '# The OpenCode Home Assistant app',
  '',
  "You're running in the OpenCode app for Home Assistant, a Debian container that's reset on every start.",
  '',
  "- Only `/data/home` (`$HOME`, where projects go), `/homeassistant` (Home Assistant's configuration), `/share` and `/config` (the app's config folder, with the user's `opencode.json`, `AGENTS.md`, `skills` and `mise.toml`) are kept.",
  "- Load the `opencode-app` skill before installing tools or system packages, changing the app's or OpenCode's config, or when an update or restart comes up.",
  "- Load `opencode-app-home-assistant` before using Home Assistant's MCP servers or API, and `opencode-app-music-assistant` before using Music Assistant.",
  '- Never update or restart OpenCode or the app yourself: ask the user.',
].join('\n');

const UpdateResult = Schema.Struct({
  updated: Schema.Array(
    Schema.Struct({
      tool: Schema.String,
      from: Schema.optional(Schema.String),
      to: Schema.String,
    })
  ),
  failed: Schema.Array(Schema.String),
  openCode: Schema.Struct({ before: Schema.String, after: Schema.String }),
  restartNeeded: Schema.Boolean,
});

const ErrorBody = Schema.Struct({ error: Schema.String });

class AppUpdateError extends Schema.TaggedError<AppUpdateError>()('AppUpdateError', {
  message: Schema.String,
}) {}

const socket = process.env['OPENCODE_APP_CONTROL_SOCKET'] ?? '/run/opencode-app.sock';

const control = (path: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`http://app${path}`, { method: 'POST', unix: socket });

      return { ok: response.ok, body: response.status === 202 ? null : await response.json() };
    },
    catch: (cause) => new AppUpdateError({ message: `The app didn't answer: ${String(cause)}` }),
  });

/**
 * The session shows a plugin's message as its one-line description, so that line is the whole
 * report. The text, which the model reads, has the same with a line per tool.
 */
const report = (result: typeof UpdateResult.Type) => {
  const updates = result.updated.map(
    (update) => `${update.tool} ${update.from ?? 'new'} → ${update.to}`
  );

  const summary = [
    updates.length === 0 ? 'Everything is up to date' : `Updated ${updates.join(', ')}`,
    ...(result.failed.length > 0 ? [`couldn't update ${result.failed.join(', ')}`] : []),
    ...(result.restartNeeded
      ? [
          `OpenCode ${result.openCode.after} restarts now, stopping anything running in other sessions. Reload the page once it's back`,
        ]
      : []),
  ].join('. ');

  return {
    description: `App update: ${summary}.`,
    text: [
      'The Home Assistant app updated its tools.',
      ...(updates.length === 0
        ? ['Everything is up to date.']
        : updates.map((line) => `- ${line}`)),
      ...(result.failed.length > 0 ? [`Couldn't update: ${result.failed.join(', ')}`] : []),
      ...(result.restartNeeded ? [`OpenCode ${result.openCode.after} restarts now.`] : []),
    ].join('\n'),
  };
};

const failure = (message: string) => ({
  description: `App update failed: ${message}`,
  text: `The Home Assistant app couldn't update its tools: ${message}`,
  metadata: { state: 'error' },
});

const update = Effect.gen(function* () {
  const response = yield* control('/update');

  if (!response.ok) {
    const body = yield* Schema.decodeUnknownEffect(ErrorBody)(response.body);

    return yield* new AppUpdateError({ message: body.error });
  }

  return yield* Schema.decodeUnknownEffect(UpdateResult)(response.body);
});

const feedback = (notes: string) =>
  [
    'Report a problem or idea for the OpenCode Home Assistant app as an issue on timmo001/app-opencode.',
    ...(notes.trim() === '' ? [] : ['', `The user says: ${notes.trim()}`]),
    '',
    '1. Work out what to report from the user and this session: what was tried, what happened, any error and any workaround found. Ask the user if it is unclear.',
    '2. Collect the details that help: `opencode --version`, `uname -m`, and any relevant config or command output. Leave out tokens, passwords and other secrets. Ask the user for the app version if it matters; it is on the app page in Home Assistant.',
    "3. Search the repo's open and closed issues with `gh issue list --repo timmo001/app-opencode --state all --search`. If one covers it, show it and offer to add a comment instead.",
    '4. Show the user the title and body, and change them until they are happy.',
    '5. Once they confirm, open it with `gh issue create --repo timmo001/app-opencode` and share the link. If `gh` is not signed in, give them a link to https://github.com/timmo001/app-opencode/issues/new with the title and body filled in instead.',
  ].join('\n');

export default Plugin.define({
  id: 'opencode-app',
  effect: Effect.fn(function* (ctx) {
    yield* ctx.session.hook('context', (event) =>
      Effect.sync(() => event.system.push({ type: 'text', text: environment }))
    );

    yield* ctx.command.transform((editor) => {
      editor.add({
        name: 'app-update',
        description: 'Update OpenCode and the tools the Home Assistant app comes with',
        execute: Effect.fn(function* (input) {
          const result = yield* update.pipe(Effect.result);

          yield* ctx.session.synthetic({
            sessionID: input.sessionID,
            ...(Result.isSuccess(result)
              ? report(result.success)
              : failure(result.failure.message)),
            resume: false,
          });

          if (Result.isSuccess(result) && result.success.restartNeeded) yield* control('/restart');
        }),
      });

      editor.add({
        name: 'app-feedback',
        description: 'Report a problem or idea for the Home Assistant app on GitHub',
        execute: (input) =>
          ctx.session.synthetic({
            sessionID: input.sessionID,
            description: 'App feedback',
            text: feedback(input.prompt.text),
          }),
      });
    });
  }),
});
