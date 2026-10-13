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
        Each button signs this browser in to OpenCode with a link that works once, in a new tab.
      </p>
      <div id="warnings" class="warnings" hidden></div>
      <p id="message" class="muted"></p>
    </main>
    <script type="module">
      const $ = (id) => document.getElementById(id);
      let status;

      const request = async (path, method = 'GET') => {
        const response = await fetch(path, { method });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? response.statusText);
        return body;
      };

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
      const open = async (remote) => {
        const tab = window.open('', '_blank');
        try {
          const pair = await request('api/pair', 'POST');
          const base =
            remote && status.remoteUrl
              ? status.remoteUrl
              : 'http://' + window.top.location.hostname + ':' + status.hostPort;
          tab.location = new URL('/auth/connect/' + pair.code, base).href;
        } catch (error) {
          tab?.close();
          $('message').textContent = "Couldn't open OpenCode: " + error.message;
        }
      };

      $('open-local').addEventListener('click', () => open(false));
      $('open-remote').addEventListener('click', () => open(true));
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
