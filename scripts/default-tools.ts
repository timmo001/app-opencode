// Writes the tools option's default list to dist/default-tools.txt, one `name@version` a line,
// so the image installs the same tools that opencode/config.yaml gives a new install.
import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Effect, FileSystem, Schema } from 'effect';
import { parseTool } from '../src/Tools.js';

const AppConfig = Schema.Struct({
  options: Schema.Struct({ tools: Schema.Array(Schema.String) }),
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString('opencode/config.yaml');
  const config = yield* Schema.decodeUnknownEffect(AppConfig)(Bun.YAML.parse(text));

  const lines = config.options.tools.map((entry) => {
    const tool = parseTool(entry);

    return `${tool.name}@${tool.version}`;
  });

  yield* fs.writeFileString('dist/default-tools.txt', `${lines.join('\n')}\n`);
});

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
