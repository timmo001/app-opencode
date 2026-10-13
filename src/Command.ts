import { Effect, Schema, Stream } from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';

export class CommandError extends Schema.TaggedError<CommandError>()('CommandError', {
  command: Schema.String,
  exitCode: Schema.optional(Schema.Number),
  output: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message() {
    const lines = this.output.trim().split('\n');
    // A tool that marks its errors, as mise does, ends with hints, so its first error says more.
    const reason = lines.find((line) => line.includes('ERROR')) ?? lines.at(-1) ?? '';

    return this.exitCode === undefined
      ? `${this.command} could not start`
      : `${this.command} exited with ${this.exitCode}${reason === '' ? '' : `: ${reason.trim()}`}`;
  }
}

export interface Result {
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunOptions extends ChildProcess.CommandOptions {
  /** Logs each line of output as it comes, for long runs whose progress is worth seeing. */
  readonly log?: boolean;
}

/**
 * Runs a command to completion with its arguments passed as they are, never
 * through a shell, and fails when it exits with anything but 0. Its output
 * isn't logged unless `log` is set: callers log what happened, and a failure
 * keeps the output.
 */
export const run = Effect.fn('Command.run')(function* (
  command: string,
  args: ReadonlyArray<string>,
  { log = false, ...options }: RunOptions = {}
) {
  const name = [command, ...args.slice(0, 2)].join(' ');
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const failed = (cause: unknown) => new CommandError({ command: name, output: '', cause });

  const handle = yield* spawner
    .spawn(ChildProcess.make(command, args, options))
    .pipe(Effect.mapError(failed));

  const collect = <E>(output: Stream.Stream<Uint8Array, E>) =>
    output.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.tap((line) =>
        log && line.trim() !== ''
          ? Effect.logInfo(line).pipe(Effect.annotateLogs('command', command))
          : Effect.void
      ),
      Stream.map((line) => `${line}\n`),
      Stream.mkString
    );

  const [stdout, stderr] = yield* Effect.all([collect(handle.stdout), collect(handle.stderr)], {
    concurrency: 'unbounded',
  }).pipe(Effect.mapError(failed));

  const exitCode = yield* handle.exitCode.pipe(Effect.mapError(failed));

  if (exitCode !== 0) {
    return yield* new CommandError({ command: name, exitCode, output: `${stdout}${stderr}` });
  }

  return { stdout, stderr } satisfies Result;
}, Effect.scoped);

export * as Command from './Command.js';
