import { Plugin } from '@opencode/plugin/effect';
import { Effect, Schema } from 'effect';

/**
 * Adds `/app-update`, which asks the app to update OpenCode and the built-in tools, reports what
 * changed in the session, then has the app restart OpenCode when it changed.
 *
 * Bundled with `effect` and `@opencode/plugin` left external, so it uses OpenCode's own copies.
 */

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

const report = (result: typeof UpdateResult.Type) => {
  const lines =
    result.updated.length === 0
      ? ['Everything is up to date.']
      : result.updated.map((update) => `- ${update.tool}: ${update.from ?? 'new'} → ${update.to}`);

  if (result.failed.length > 0) lines.push('', `Couldn't update: ${result.failed.join(', ')}`);

  if (result.restartNeeded) {
    lines.push(
      '',
      `OpenCode ${result.openCode.after} is installed. OpenCode restarts now, which stops anything ` +
        'running in other sessions. Reload the page once it is back.'
    );
  }

  return lines.join('\n');
};

export default Plugin.define({
  id: 'opencode-app',
  effect: Effect.fn(function* (ctx) {
    yield* ctx.command.transform((editor) => {
      editor.add({
        name: 'app-update',
        description: 'Update OpenCode and the tools the Home Assistant app comes with',
        execute: Effect.fn(function* (input) {
          const response = yield* control('/update');

          if (!response.ok) {
            const body = yield* Schema.decodeUnknownEffect(ErrorBody)(response.body);

            return yield* new AppUpdateError({ message: body.error });
          }

          const result = yield* Schema.decodeUnknownEffect(UpdateResult)(response.body);

          yield* ctx.session.synthetic({
            sessionID: input.sessionID,
            text: report(result),
            description: 'App update',
            resume: false,
          });

          if (result.restartNeeded) yield* control('/restart');
        }),
      });
    });
  }),
});
