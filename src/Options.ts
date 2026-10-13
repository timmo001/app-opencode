import { Context, Effect, FileSystem, Layer, Schema } from 'effect';
import { Paths } from './Paths.js';

/** `/data/options.json`, as the schema in `opencode/config.yaml` lets the Supervisor write it. */
const Options = Schema.Struct({
  server_password: Schema.optional(Schema.String),
  remote_access: Schema.Boolean,
  system_packages: Schema.Array(Schema.String),
  tools: Schema.Array(Schema.String),
});

export type Interface = typeof Options.Type;

export class Service extends Context.Service<Service, Interface>()('app-opencode/Options') {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Paths.Service;
    const text = yield* fs.readFileString(`${paths.data}/options.json`);

    return Service.of(yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Options))(text));
  })
);

export * as Options from './Options.js';
