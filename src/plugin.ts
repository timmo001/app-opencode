import { Plugin } from '@opencode/plugin/effect';
import { Effect, Result, Schema } from 'effect';

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

export default Plugin.define({
  id: 'opencode-app',
  effect: Effect.fn(function* (ctx) {
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
    });
  }),
});
