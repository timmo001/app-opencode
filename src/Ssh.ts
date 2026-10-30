import { Config, Effect, FileSystem, Layer, Option } from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';
import { Command } from './Command.js';
import { Log } from './Log.js';
import { Options } from './Options.js';
import { Paths } from './Paths.js';

/** The container port `opencode/config.yaml` offers for SSH, closed until you give it a host port. */
export const port = 22;

/**
 * The app's own environment, which SSH sessions don't get from Docker or the Supervisor. Passed on
 * so a shell or Herdr there has the same tools, home and Home Assistant access as the sidebar's.
 */
const passedOn = [
  'HOME',
  'PATH',
  'LANG',
  'EDITOR',
  'MISE_YES',
  'OPENCODE_DISABLE_AUTOUPDATE',
  'HA_BRIDGE_SOCK',
  'SUPERVISOR_TOKEN',
];

/** sshd_config can't take these unquoted, and none of the variables above has them. */
const plain = /^[^\s"'\\]+$/;

const sshdConfig = (dir: string, env: ReadonlyArray<string>) =>
  [
    `Port ${port}`,
    `HostKey ${dir}/ssh_host_ed25519_key`,
    `AuthorizedKeysFile ${dir}/authorized_keys`,
    'PermitRootLogin prohibit-password',
    'PasswordAuthentication no',
    'KbdInteractiveAuthentication no',
    'PrintMotd no',
    'PidFile none',
    'Subsystem sftp internal-sftp',
    ...(env.length === 0 ? [] : [`SetEnv ${env.join(' ')}`]),
    '',
  ].join('\n');

/**
 * Runs an SSH server while the `ssh_authorized_keys` option lists any keys, so you can reach the
 * app's shell from your own terminal, and add it to Herdr as a machine. Its host key is kept in
 * `/data`, so clients don't see it change between restarts.
 */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const paths = yield* Paths.Service;
    const options = yield* Options.Service;
    const keys = options.ssh_authorized_keys ?? [];

    if (keys.length === 0) return;

    const dir = `${paths.data}/ssh`;
    const config = `${dir}/sshd_config`;

    const prepare = Effect.gen(function* () {
      yield* fs.makeDirectory(dir, { recursive: true, mode: 0o700 });
      // sshd's privilege separation folder, which the container starts without.
      yield* fs.makeDirectory('/run/sshd', { recursive: true, mode: 0o755 });

      if (!(yield* fs.exists(`${dir}/ssh_host_ed25519_key`))) {
        yield* Command.run('ssh-keygen', [
          '-q',
          '-t',
          'ed25519',
          '-N',
          '',
          '-C',
          'opencode-app',
          '-f',
          `${dir}/ssh_host_ed25519_key`,
        ]);
      }

      const env: Array<string> = [];

      for (const name of passedOn) {
        const value = yield* Config.String(name).pipe(Config.option);

        if (Option.isSome(value) && plain.test(value.value)) env.push(`${name}=${value.value}`);
      }

      yield* fs.writeFileString(`${dir}/authorized_keys`, `${keys.join('\n')}\n`, { mode: 0o600 });
      yield* fs.writeFileString(config, sshdConfig(dir, env), { mode: 0o600 });
    });

    const ready = yield* prepare.pipe(
      Effect.as(true),
      Effect.catch((error) =>
        Effect.logWarning(`The SSH server couldn't start: ${error.message}`).pipe(Effect.as(false))
      )
    );

    if (!ready) return;

    yield* Log.step('Starting the SSH server');

    // A crash starts it again after a pause, so a bad config can't spin.
    yield* spawner
      .spawn(
        ChildProcess.make('/usr/sbin/sshd', ['-D', '-e', '-f', config], {
          stdout: 'inherit',
          stderr: 'inherit',
        })
      )
      .pipe(
        Effect.flatMap((handle) => handle.exitCode),
        Effect.flatMap((code) => Effect.logError(`The SSH server stopped with exit code ${code}`)),
        Effect.scoped,
        Effect.catch((error) => Effect.logError(`The SSH server couldn't run: ${error.message}`)),
        Effect.andThen(Effect.sleep('5 seconds')),
        Effect.forever,
        Effect.forkScoped
      );
  })
);

export * as Ssh from './Ssh.js';
