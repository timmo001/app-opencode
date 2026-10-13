import { Config, Context, Effect, Layer } from 'effect';

export interface Interface {
  /** The app's persistent storage, `/data` under the Supervisor. */
  readonly data: string;
  /** The app's own config folder, `/config` under the Supervisor, which you can edit. */
  readonly config: string;
  /** `HOME`, where OpenCode, mise, gh, git and ssh keep their state. */
  readonly home: string;
  /** An empty folder of the app's own, so no project's `mise.toml` is in effect when the app runs mise. */
  readonly state: string;
  /** The socket the OpenCode plugin asks the app to update through. */
  readonly controlSocket: string;
  /** The OpenCode plugin the image ships. */
  readonly plugin: string;
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Paths') {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const data = yield* Config.String('OPENCODE_APP_DATA').pipe(Config.withDefault('/data'));
    const config = yield* Config.String('OPENCODE_APP_CONFIG').pipe(Config.withDefault('/config'));
    const home = yield* Config.String('HOME').pipe(Config.withDefault(`${data}/home`));

    const controlSocket = yield* Config.String('OPENCODE_APP_CONTROL_SOCKET').pipe(
      Config.withDefault('/run/opencode-app.sock')
    );

    const plugin = yield* Config.String('OPENCODE_APP_PLUGIN').pipe(
      Config.withDefault('/usr/local/share/opencode-app/plugin.js')
    );

    return Service.of({
      data,
      config,
      home,
      state: `${home}/.local/share/opencode-app`,
      controlSocket,
      plugin,
    });
  })
);

export * as Paths from './Paths.js';
