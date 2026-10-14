import { Config, Context, Effect, Layer, Option, Schema } from 'effect';
import { Socket } from 'effect/socket';
import { Options } from './Options.js';

export interface Resolved {
  /** OpenCode config to pass in `OPENCODE_CONFIG_CONTENT`, when there's anything to connect. */
  readonly config: string | undefined;
  /** Environment for OpenCode, and so for the agent's shell. */
  readonly env: Readonly<Record<string, string>>;
}

export interface Interface {
  /** Works out what OpenCode connects to now. Anything it can't reach is left out and logged. */
  readonly resolve: Effect.Effect<Resolved>;
}

export class ConnectionsError extends Schema.TaggedError<ConnectionsError>()('ConnectionsError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message() {
    return `${this.operation} failed: ${String(this.cause)}`;
  }
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Connections') {}

const HomeAssistantMessage = Schema.fromJsonString(
  Schema.Struct({
    type: Schema.String,
    success: Schema.optional(Schema.Boolean),
    result: Schema.optional(Schema.Unknown),
    error: Schema.optional(Schema.Struct({ message: Schema.String })),
    message: Schema.optional(Schema.String),
  })
);

const LlmApis = Schema.Struct({
  apis: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
});

// OpenCode fills in tokens from the environment when it loads the config, so they're never written
// to disk.
interface RemoteServer {
  readonly type: 'remote';
  readonly url: string;
  readonly oauth: false;
  readonly headers: { readonly Authorization: string };
}

type Servers = Record<string, RemoteServer>;

/** The messages this client sends over Home Assistant's WebSocket API. */
type Outgoing =
  | { readonly type: 'auth'; readonly access_token: string }
  | { readonly id: number; readonly type: 'llm/api/list' };

const remote = (url: string, token: string): RemoteServer => ({
  type: 'remote',
  url,
  oauth: false,
  headers: { Authorization: `Bearer {env:${token}}` },
});

const serverName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The LLM APIs Home Assistant has, through the Supervisor's WebSocket proxy. Each MCP server
 * Home Assistant connects to, such as one an app announced, is one of them.
 */
const llmApis = Effect.fn('Connections.llmApis')(
  function* (token: string) {
    const socket = yield* Socket.makeWebSocket('ws://supervisor/core/websocket', {
      openTimeout: '10 seconds',
    });

    const pull = yield* Socket.readerString(socket);
    const writer = yield* socket.writer;
    const buffered: Array<string> = [];

    const next = Effect.gen(function* () {
      while (buffered.length === 0) {
        buffered.push(...(yield* pull));
      }

      return yield* Schema.decodeUnknownEffect(HomeAssistantMessage)(buffered.shift());
    });

    const send = (message: Outgoing) => writer.write(JSON.stringify(message));

    yield* next;
    yield* send({ type: 'auth', access_token: token });
    const auth = yield* next;

    if (auth.type !== 'auth_ok') {
      return yield* new ConnectionsError({
        operation: 'Signing in to Home Assistant',
        cause: auth.message ?? auth.type,
      });
    }

    yield* send({ id: 1, type: 'llm/api/list' });
    const reply = yield* next;

    if (reply.success !== true) {
      return yield* new ConnectionsError({
        operation: 'Listing LLM APIs',
        cause: reply.error?.message ?? reply.type,
      });
    }

    return (yield* Schema.decodeUnknownEffect(LlmApis)(reply.result)).apis;
  },
  Effect.scoped,
  Effect.timeout('15 seconds')
);

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const options = yield* Options.Service;
    const supervisorToken = yield* Config.String('SUPERVISOR_TOKEN').pipe(Config.option);

    const homeAssistant = Effect.gen(function* () {
      const servers: Servers = {};

      servers['home-assistant'] = remote('http://supervisor/core/api/mcp', 'SUPERVISOR_TOKEN');

      if (Option.isNone(supervisorToken)) {
        return servers;
      }

      const apis = yield* llmApis(supervisorToken.value).pipe(
        Effect.provide(Socket.layerWebSocketConstructorGlobal),
        Effect.catch((error) =>
          Effect.logWarning(
            `Couldn't list the MCP servers Home Assistant connects to: ${error.message}`
          ).pipe(Effect.as([]))
        )
      );

      for (const api of apis) {
        const name = serverName(api.name);

        if (api.id.startsWith('mcp-') && name !== '' && !(name in servers)) {
          servers[name] = remote(
            `http://supervisor/core/api/mcp/${encodeURIComponent(api.id)}`,
            'SUPERVISOR_TOKEN'
          );
        }
      }

      return servers;
    });

    const resolve = Effect.gen(function* () {
      const servers: Servers = options.home_assistant_mcp === false ? {} : yield* homeAssistant;
      const env: Record<string, string> = {};

      const names = Object.keys(servers);

      if (names.length > 0) {
        yield* Effect.logInfo(`Connecting OpenCode to ${names.join(', ')}`);
      }

      return {
        config: names.length > 0 ? JSON.stringify({ mcp: { servers } }) : undefined,
        env,
      };
    }).pipe(Effect.withSpan('Connections.resolve'));

    return Service.of({ resolve });
  })
);

export * as Connections from './Connections.js';
