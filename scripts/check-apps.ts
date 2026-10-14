// Checks opencode_manager/config.yaml only differs from opencode/config.yaml where it should: the
// two apps share one image and version, so anything else drifting apart would be a mistake.
import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Effect, FileSystem, Schema } from 'effect';

const allowed = new Set(['name', 'slug', 'description', 'panel_title', 'ports', 'hassio_role']);

const AppConfig = Schema.Record(Schema.String, Schema.Unknown);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  const read = (path: string) =>
    fs
      .readFileString(path)
      .pipe(Effect.flatMap((text) => Schema.decodeUnknownEffect(AppConfig)(Bun.YAML.parse(text))));

  const app = yield* read('opencode/config.yaml');
  const manager = yield* read('opencode_manager/config.yaml');
  const keys = new Set([...Object.keys(app), ...Object.keys(manager)]);

  const different = [...keys].filter(
    (key) =>
      !allowed.has(key) && JSON.stringify(app[key] ?? null) !== JSON.stringify(manager[key] ?? null)
  );

  if (different.length > 0) {
    return yield* Effect.fail(
      `opencode_manager/config.yaml differs from opencode/config.yaml in: ${different.join(', ')}`
    );
  }
});

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
