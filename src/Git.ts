import { Effect, Schema } from 'effect';
import { Command } from './Command.js';

const GitHubUser = Schema.fromJsonString(
  Schema.Struct({
    id: Schema.Number,
    login: Schema.String,
    name: Schema.NullOr(Schema.String),
    email: Schema.NullOr(Schema.String),
  })
);

const run = (command: string, args: ReadonlyArray<string>) =>
  Command.run(command, args, { extendEnv: true });

/** A `git config --global` value, or undefined when it isn't set. */
const globalValue = (key: string) =>
  run('git', ['config', '--global', '--get', key]).pipe(
    Effect.map(({ stdout }) => stdout.trim() || undefined),
    Effect.orElseSucceed(() => undefined)
  );

/**
 * Fills in your Git name and email from your GitHub account when they aren't set, so commits
 * work once you've signed in with `gh auth login`. A private email uses GitHub's noreply address.
 * Never fails: without a sign-in, it waits for the next start.
 */
export const setIdentity = Effect.fn('Git.setIdentity')(
  function* () {
    const name = yield* globalValue('user.name');
    const email = yield* globalValue('user.email');

    if (name !== undefined && email !== undefined) return;

    // @timmo001/effect-gh needs a newer Effect than OpenCode's client and plugin, which this
    // app matches, and this is one call.
    // oxlint-disable-next-line timmo-effect/no-raw-gh
    const user = yield* run('gh', ['api', 'user']).pipe(
      Effect.flatMap(({ stdout }) => Schema.decodeUnknownEffect(GitHubUser)(stdout)),
      Effect.orElseSucceed(() => undefined)
    );

    if (user === undefined) return;

    if (name === undefined) {
      yield* run('git', ['config', '--global', 'user.name', user.name ?? user.login]);
    }

    if (email === undefined) {
      yield* run('git', [
        'config',
        '--global',
        'user.email',
        user.email ?? `${user.id}+${user.login}@users.noreply.github.com`,
      ]);
    }

    yield* Effect.logInfo(`Set your Git name and email from GitHub (${user.login})`);
  },
  Effect.catch((error) =>
    Effect.logWarning(`Couldn't set your Git name and email: ${error.message}`)
  )
);

export * as Git from './Git.js';
