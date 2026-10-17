import { Context, Effect, Layer, Schema, SynchronizedRef } from 'effect';
import { Socket } from 'effect/socket';
import { OpenCodeServer } from './OpenCodeServer.js';
import { Tools } from './Tools.js';

/** The terminals the sidebar page offers: OpenCode's TUI and a shell. */
export const Kind = Schema.Literals(['tui', 'shell']);

export type Kind = typeof Kind.Type;

export const Size = Schema.Struct({
  cols: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1000 })),
  rows: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1000 })),
});

export interface Size extends Schema.Schema.Type<typeof Size> {}

export interface Interface {
  /**
   * Pipes the page's socket to the kind's terminal until either side closes. The terminal is
   * started when it isn't running, and kept running when the page goes, so a reload picks it up.
   */
  readonly attach: (
    kind: Kind,
    size: Size,
    page: Socket.Socket
  ) => Effect.Effect<void, TerminalError>;
  readonly resize: (kind: Kind, size: Size) => Effect.Effect<void, TerminalError>;
}

export class TerminalError extends Schema.TaggedError<TerminalError>()('TerminalError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message() {
    return `${this.operation} failed: ${String(this.cause)}`;
  }
}

export class Service extends Context.Service<Service, Interface>()('app-opencode/Terminal') {}

/**
 * Sent to the page before the socket closes when the program in the terminal has ended, since
 * ingress doesn't pass close codes on. It has the same form as OpenCode's own control frame: a
 * zero byte, then JSON.
 */
const exitedFrame = new Uint8Array([0, ...new TextEncoder().encode('{"exited":true}')]);

/** OpenCode closes the socket with these once the terminal's program has ended. */
const exitCodes = new Set([1000, 4404]);

const terminalError = (operation: string) =>
  Effect.mapError((cause: unknown) => new TerminalError({ operation, cause }));

const ended = (error: { readonly message: string }) =>
  Effect.logWarning(`The terminal's connection to OpenCode ended: ${error.message}`);

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const server = yield* OpenCodeServer.Service;
    const tools = yield* Tools.Service;
    const webSocket = yield* Socket.WebSocketConstructor;
    const terminals = yield* SynchronizedRef.make<Partial<Record<Kind, OpenCodeServer.PtyID>>>({});

    // The TUI is the server's own OpenCode, which finds the service through service.json and
    // attaches to it, so it shares sessions with the web app and paired devices.
    const start = (kind: Kind) =>
      kind === 'tui'
        ? tools.serverOpenCode.pipe(
            Effect.flatMap((openCode) =>
              server.createPty({ title: 'OpenCode', command: openCode.path })
            )
          )
        : server.createPty({ title: 'Shell' });

    const running = (kind: Kind) =>
      SynchronizedRef.modifyEffect(terminals, (current) =>
        Effect.gen(function* () {
          const existing = current[kind];

          if (existing !== undefined && (yield* server.ptyRunning(existing))) {
            return [existing, current] as const;
          }

          const started = yield* start(kind);

          return [started, { ...current, [kind]: started }] as const;
        })
      );

    const pipeSockets = Effect.fnUntraced(function* (page: Socket.Socket, url: string) {
      const openCode = yield* Socket.makeWebSocket(url).pipe(
        Effect.provideService(Socket.WebSocketConstructor, webSocket)
      );

      const toPage = yield* page.writer;

      const fromPage = Effect.gen(function* () {
        const reader = yield* page.reader;
        const writer = yield* openCode.writer;

        return yield* reader.pull.pipe(Effect.flatMap(writer.writeAll), Effect.forever);
      });

      const fromOpenCode = Effect.gen(function* () {
        const reader = yield* openCode.reader;

        return yield* reader.pull.pipe(Effect.flatMap(toPage.writeAll), Effect.forever);
      }).pipe(
        Effect.catchReason('SocketError', 'SocketCloseError', (reason) =>
          exitCodes.has(reason.code) ? toPage.write(exitedFrame) : ended(reason)
        ),
        Effect.catch(ended),
        Effect.andThen(toPage.write(new Socket.CloseEvent(1000))),
        Effect.ignore
      );

      // The page going ends this too, and closing the scope closes OpenCode's socket.
      yield* Effect.raceFirst(fromPage.pipe(Effect.ignore), fromOpenCode);
    }, Effect.scoped);

    const attach = Effect.fn('Terminal.attach')(function* (
      kind: Kind,
      size: Size,
      page: Socket.Socket
    ) {
      const url = yield* running(kind).pipe(
        Effect.tap((id) => server.resizePty(id, size)),
        Effect.flatMap(server.ptySocketUrl),
        terminalError('Opening the terminal')
      );

      yield* pipeSockets(page, url);
    });

    const resize = Effect.fn('Terminal.resize')(function* (kind: Kind, size: Size) {
      const id = (yield* SynchronizedRef.get(terminals))[kind];

      if (id !== undefined) {
        yield* server.resizePty(id, size).pipe(terminalError('Resizing the terminal'));
      }
    });

    return Service.of({ attach, resize });
  })
).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal));

export * as Terminal from './Terminal.js';
