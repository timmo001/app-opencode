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
        display: grid;
        place-items: center;
        min-height: 100vh;
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
    <main>
      <h1>OpenCode</h1>
      <p id="status" class="muted">Loading…</p>
      <div class="actions">
        <button id="open-local" class="primary" hidden>Open on this network</button>
        <button id="open-remote" class="primary" hidden>Open with remote access</button>
        <button id="update">Update and restart</button>
      </div>
      <p class="muted">
        Each button signs this browser in to OpenCode with a link that works once, in a new tab. You don't need a
        password.
      </p>
      <h2>Pair a device</h2>
      <p class="muted">
        Sign in from your phone, another computer or the OpenCode desktop app: scan the code, or open or paste one
        of the links there.
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

      load().catch((error) => {
        $('status').textContent = "Couldn't reach the app: " + error.message;
      });
    </script>
  </body>
</html>
`;

export * as Page from './Page.js';
