import { Effect, Schema, Stream } from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';

export class CommandError extends Schema.TaggedError<CommandError>()('CommandError', {
  command: Schema.String,
  exitCode: Schema.optional(Schema.Number),
  output: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message() {
    const last = this.output.trim().split('\n').at(-1) ?? '';

    return this.exitCode === undefined
      ? `${this.command} could not start`
      : `${this.command} exited with ${this.exitCode}${last === '' ? '' : `: ${last}`}`;
  }
}

export interface Result {
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs a command to completion with its arguments passed as they are, never
 * through a shell, and fails when it exits with anything but 0. Its output
 * isn't logged: callers log what happened, and a failure keeps the output.
 */
export const run = Effect.fn('Command.run')(function* (
  command: string,
  args: ReadonlyArray<string>,
  options: ChildProcess.CommandOptions = {}
) {
  const name = [command, ...args.slice(0, 2)].join(' ');
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const failed = (cause: unknown) => new CommandError({ command: name, output: '', cause });

  const handle = yield* spawner
    .spawn(ChildProcess.make(command, args, options))
    .pipe(Effect.mapError(failed));

  const [stdout, stderr] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
      handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
    ],
    { concurrency: 'unbounded' }
  ).pipe(Effect.mapError(failed));

  const exitCode = yield* handle.exitCode.pipe(Effect.mapError(failed));

  if (exitCode !== 0) {
    return yield* new CommandError({ command: name, exitCode, output: `${stdout}${stderr}` });
  }

  return { stdout, stderr } satisfies Result;
}, Effect.scoped);

export * as Command from './Command.js';
