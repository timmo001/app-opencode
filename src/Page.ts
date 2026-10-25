/**
 * The sidebar page. Its script avoids template literals, so it can sit in one here, and uses
 * relative URLs, so it works under whatever path the Supervisor gives ingress.
 */
export const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenCode</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, sans-serif;
      }
      body {
        margin: 0;
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
      }
      nav {
        display: flex;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      }
      nav button {
        border: none;
        border-radius: 0.4rem;
        padding: 0.4rem 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      nav svg {
        width: 1.1em;
        height: 1.1em;
        fill: currentColor;
      }
      nav button[aria-selected='true'] {
        background: color-mix(in srgb, #18bcf2 25%, transparent);
      }
      nav [role='tablist'] {
        display: contents;
      }
      nav button[hidden] {
        display: none;
      }
      #menu {
        padding: 0.4rem;
      }
      .panel {
        flex: 1;
        min-height: 0;
        position: relative;
      }
      .panel[hidden] {
        display: none;
      }
      .terminal {
        background: #1e1e1e;
      }
      .terminal > div {
        position: absolute;
        inset: 0.25rem 0 0 0.5rem;
      }
      .terminal .overlay {
        position: absolute;
        top: 0.5rem;
        right: 0.75rem;
        margin: 0;
        padding: 0.3rem 0.6rem;
        border-radius: 0.4rem;
        background: #333;
        color: #ddd;
        font-size: 0.85rem;
      }
      #panel-connect:not([hidden]) {
        overflow: auto;
        display: grid;
        place-items: center;
      }
      main {
        max-width: 32rem;
        padding: 1.5rem;
      }
      h1 {
        margin-top: 0;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 1rem 0;
      }
      button {
        font: inherit;
        padding: 0.6rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid currentColor;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      button.primary {
        background: #18bcf2;
        border-color: #18bcf2;
        color: #fff;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .muted {
        opacity: 0.7;
        font-size: 0.9rem;
      }
      .warnings {
        border-left: 3px solid #ff9800;
        padding-left: 0.75rem;
      }
      .qr svg {
        display: block;
        width: 14rem;
        height: 14rem;
        margin: 1rem 0;
        background: #fff;
        border-radius: 0.5rem;
      }
      .link {
        display: flex;
        gap: 0.5rem;
        margin: 0.5rem 0;
      }
      .link input {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: 0.85rem;
        padding: 0.4rem;
      }
    </style>
  </head>
  <body>
    <nav>
      <button id="menu" aria-label="Home Assistant sidebar" title="Home Assistant sidebar" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
        </svg>
      </button>
      <div role="tablist">
        <button id="tab-tui" role="tab" aria-controls="panel-tui">
          <svg viewBox="96 96 320 320" aria-hidden="true">
            <path d="M320 224V352H192V224H320Z" opacity="0.5" />
            <path fill-rule="evenodd" d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z" />
          </svg>
          OpenCode
        </button>
        <button id="tab-shell" role="tab" aria-controls="panel-shell">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5C2,3.89 2.9,3 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z"
            />
          </svg>
          Shell
        </button>
        <button id="tab-connect" role="tab" aria-controls="panel-connect">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3.9,12C3.9,10.29 5.29,8.9 7,8.9H11V7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12M8,13H16V11H8V13M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.71 18.71,15.1 17,15.1H13V17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7Z"
            />
          </svg>
          Connect
        </button>
      </div>
    </nav>
    <section id="panel-tui" class="panel terminal" role="tabpanel" hidden>
      <div id="terminal-tui"></div>
      <p id="overlay-tui" class="overlay" hidden></p>
    </section>
    <section id="panel-shell" class="panel terminal" role="tabpanel" hidden>
      <div id="terminal-shell"></div>
      <p id="overlay-shell" class="overlay" hidden></p>
    </section>
    <section id="panel-connect" class="panel" role="tabpanel" hidden>
      <main>
        <h1>OpenCode</h1>
        <p id="status" class="muted">Loading…</p>
        <div class="actions">
          <button id="open-local" class="primary" hidden>Open on this network</button>
          <button id="open-remote" class="primary" hidden>Open with remote access</button>
          <button id="update">Update and restart</button>
        </div>
        <p class="muted">
          Each button signs this browser in to OpenCode with a link that works once, in a new tab. You don't need
          a password.
        </p>
        <h2>Pair a device</h2>
        <p class="muted">
          Sign in from your phone, another computer or the OpenCode desktop app: scan the code, or open or paste
          one of the links there.
        </p>
        <div class="actions">
          <button id="pair">Show a pairing code</button>
        </div>
        <div id="pairing" hidden>
          <div id="qr" class="qr"></div>
          <div id="links"></div>
          <p id="expiry" class="muted"></p>
        </div>
        <div id="warnings" class="warnings" hidden></div>
        <p id="message" class="muted"></p>
      </main>
    </section>
    <script type="module">
      const $ = (id) => document.getElementById(id);
      let status;

      const request = async (path, method = 'GET', body) => {
        const response = await fetch(path, {
          method,
          headers: body === undefined ? {} : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? response.statusText);
        return result;
      };

      // A new one-time code each time, with its links and QR code.
      const pairing = () => request('api/pair', 'POST', { host: window.top.location.hostname });

      const load = async () => {
        status = await request('api/status');
        let text = status.running ? 'OpenCode ' + status.running + ' is running.' : 'OpenCode is starting.';
        if (status.running && status.installed && status.installed !== status.running) {
          text += ' ' + status.installed + ' is installed and runs after a restart.';
        }
        $('status').textContent = text;
        $('open-local').hidden = status.hostPort === null;
        $('open-remote').hidden = !status.remoteUrl;
        $('warnings').hidden = status.warnings.length === 0;
        $('warnings').replaceChildren(
          ...status.warnings.map((warning) => {
            const line = document.createElement('p');
            line.textContent = warning;
            return line;
          })
        );
      };

      // The tab opens on the click, before the link exists, so the browser doesn't block it.
      const open = async (kind) => {
        const tab = window.open('', '_blank');
        try {
          const link = (await pairing()).links.find((candidate) => candidate.kind === kind);
          if (!link) throw new Error("that address isn't available now");
          tab.location = link.url;
        } catch (error) {
          tab?.close();
          $('message').textContent = "Couldn't open OpenCode: " + error.message;
        }
      };

      const copy = async (input) => {
        try {
          await navigator.clipboard.writeText(input.value);
        } catch {
          // Home Assistant's frame may not allow the clipboard API.
          input.select();
          document.execCommand('copy');
        }
      };

      const labels = { remote: 'Remote access', local: 'On this network' };

      $('pair').addEventListener('click', async () => {
        $('pair').disabled = true;
        try {
          const pair = await pairing();
          if (pair.links.length === 0) {
            throw new Error('turn on remote access, or map port 49374 in the Network settings');
          }
          $('qr').innerHTML = pair.qr;
          $('links').replaceChildren(
            ...pair.links.map((link) => {
              const row = document.createElement('div');
              row.className = 'link';
              const input = document.createElement('input');
              input.readOnly = true;
              input.value = link.url;
              input.title = labels[link.kind];
              const button = document.createElement('button');
              button.textContent = 'Copy ' + labels[link.kind].toLowerCase() + ' link';
              button.addEventListener('click', () => copy(input));
              row.append(input, button);
              return row;
            })
          );
          $('expiry').textContent =
            'The code works once, on any of these, and expires in ' +
            Math.round(pair.expiresIn / 60) +
            ' minutes. Show a new one for each device.';
          $('pairing').hidden = false;
          $('pair').textContent = 'Show a new pairing code';
        } catch (error) {
          $('message').textContent = "Couldn't pair: " + error.message;
        } finally {
          $('pair').disabled = false;
        }
      });

      $('open-local').addEventListener('click', () => open('local'));
      $('open-remote').addEventListener('click', () => open('remote'));
      $('update').addEventListener('click', async () => {
        if (!confirm('If OpenCode updates, it restarts, and any reply it is writing stops. Continue?')) {
          return;
        }
        $('update').disabled = true;
        $('message').textContent = 'Checking for updates…';
        try {
          const result = await request('api/update', 'POST');
          $('message').textContent =
            result.updated.length === 0
              ? 'Everything is up to date.'
              : 'Updated ' + result.updated.map((update) => update.tool + ' to ' + update.to).join(', ') + '.';
          await load();
        } catch (error) {
          $('message').textContent = "Couldn't update: " + error.message;
        } finally {
          $('update').disabled = false;
        }
      });

      // With the hide_sidebar option, Home Assistant's kiosk mode hides its sidebar and header
      // around the frame, and the menu button opens the sidebar over the page. The button only
      // shows once Home Assistant answers, so an older one that ignores kiosk mode keeps its own
      // header and doesn't get two. Home Assistant keeps kiosk mode across a reload of the frame,
      // so with the option off the page leaves it.
      const kioskMode = (enable) => {
        if (window.parent === window) return;
        if (!enable) {
          window.parent.postMessage({ type: 'home-assistant/unsubscribe-properties' }, '*');
          return;
        }
        window.addEventListener('message', (event) => {
          if (event.source === window.parent && event.data?.type === 'home-assistant/properties') {
            $('menu').hidden = false;
          }
        });
        window.parent.postMessage({ type: 'home-assistant/subscribe-properties', kioskMode: true }, '*');
      };

      $('menu').addEventListener('click', () => {
        window.parent.postMessage({ type: 'home-assistant/toggle-menu' }, '*');
      });

      load()
        .then(() => kioskMode(status.hideSidebar))
        .catch((error) => {
          $('status').textContent = "Couldn't reach the app: " + error.message;
        });

      // The terminals load on first use, so Connect still works if their script doesn't. Only the
      // shown one is kept open: the others are closed, so they don't redraw, and mounted again,
      // which replays them, when they're shown.
      const terminals = {};
      let shown;
      const overlay = (kind) => (text) => {
        $('overlay-' + kind).hidden = text === undefined;
        $('overlay-' + kind).textContent = text ?? '';
      };

      const show = async (tab) => {
        shown = tab;
        for (const name of ['tui', 'shell', 'connect']) {
          $('tab-' + name).setAttribute('aria-selected', String(name === tab));
          $('panel-' + name).hidden = name !== tab;
        }
        for (const name of Object.keys(terminals)) {
          if (name === tab) continue;
          terminals[name].then((mounted) => mounted.close()).catch(() => undefined);
          delete terminals[name];
        }
        try {
          localStorage.setItem('opencode-app-tab', tab);
        } catch {
          // Storage can be blocked in Home Assistant's frame; the page opens on OpenCode then.
        }
        if (tab === 'connect') return;
        try {
          terminals[tab] ??= import('./terminal.js').then(({ mount }) =>
            mount(tab, $('terminal-' + tab), overlay(tab))
          );
          const mounted = await terminals[tab];
          if (shown === tab) mounted.focus();
        } catch (error) {
          delete terminals[tab];
          overlay(tab)("Couldn't start the terminal: " + error.message);
        }
      };

      for (const name of ['tui', 'shell', 'connect']) {
        $('tab-' + name).addEventListener('click', () => show(name));
      }

      let saved;
      try {
        saved = localStorage.getItem('opencode-app-tab');
      } catch {
        saved = null;
      }
      show(['tui', 'shell', 'connect'].includes(saved) ? saved : 'tui');
    </script>
  </body>
</html>
`;

export * as Page from './Page.js';
