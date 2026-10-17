/**
 * The sidebar page's terminals, built for the browser into `terminal.js`. Each one is a socket to
 * the app, which pipes it to a terminal on OpenCode's server.
 */
import { FitAddon, Terminal, init } from 'ghostty-web';

export type Kind = 'tui' | 'shell';

export interface Mounted {
  /** Fits the terminal to its tab, now it's shown, and focuses it. */
  readonly show: () => void;
}

const decoder = new TextDecoder();

/** OpenCode's control frames, and the app's: a zero byte, then JSON. */
const controlFrame = (bytes: Uint8Array): { readonly exited?: boolean } | undefined =>
  bytes[0] === 0 ? JSON.parse(decoder.decode(bytes.subarray(1))) : undefined;

const fontSize = 14;
const fontFamily = 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace';

export const mount = async (
  kind: Kind,
  element: HTMLElement,
  status: (text: string | undefined) => void
): Promise<Mounted> => {
  await init();

  const terminal = new Terminal({
    // A blinking cursor redraws its line on every frame.
    cursorBlink: false,
    fontSize,
    fontFamily,
    scrollback: 10000,
    theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
  });

  const fit = new FitAddon();

  terminal.loadAddon(fit);
  terminal.open(element);
  // The terminal measures its rows when it opens, which may be before the font has loaded.
  await document.fonts.ready;
  terminal.renderer?.remeasureFont();
  fit.fit();
  fit.observeResize();

  let socket: WebSocket | undefined;
  let exited = false;

  // Each connection replays the terminal from the start, so the screen is cleared first.
  const connect = () => {
    exited = false;
    terminal.reset();
    status('Connecting…');

    const url = new URL(`api/terminal/${kind}`, location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('cols', String(terminal.cols));
    url.searchParams.set('rows', String(terminal.rows));

    const current = new WebSocket(url);
    current.binaryType = 'arraybuffer';
    socket = current;

    current.addEventListener('open', () => status(undefined));
    current.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
      if (!(event.data instanceof ArrayBuffer)) {
        terminal.write(event.data);

        return;
      }

      const bytes = new Uint8Array(event.data);
      const control = controlFrame(bytes);

      if (control === undefined) terminal.write(bytes);
      else if (control.exited === true) exited = true;
    });

    current.addEventListener('close', () => {
      if (socket !== current) return;

      socket = undefined;

      if (exited) {
        status('It has ended. Press Enter to start again.');

        return;
      }

      status('Reconnecting…');
      setTimeout(connect, 2000);
    });
  };

  terminal.onData((data) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(data);
    else if (exited && data === '\r') connect();
  });

  // Without a socket the size goes with the next one.
  terminal.onResize((size) => {
    if (socket === undefined) return;

    fetch(`api/terminal/${kind}/size`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(size),
    }).catch(() => undefined);
  });

  connect();

  return {
    show: () => {
      fit.fit();
      terminal.focus();
    },
  };
};
