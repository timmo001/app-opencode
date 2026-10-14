# OpenCode

An AI coding agent for your Home Assistant setup, powered by [OpenCode](https://opencode.ai). The app runs OpenCode 2's server, keeps it and its tools up to date, and opens it from the Home Assistant sidebar.

## The two apps

The repository has two versions of the app, which differ only in how much of the Supervisor the agent can use:

| App                           | Supervisor access                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenCode**                  | Home Assistant's own Supervisor endpoints: Core's logs, including past boots, and restarting or updating Core                                                 |
| **OpenCode (manager access)** | The Supervisor's manager role: every log (the Supervisor, the host, plugins and apps), and starting, stopping and configuring your apps, the host and backups |

Both can use all of Home Assistant's own API. Anything the agent runs in the app can use the app's access, so pick **OpenCode** unless you want the agent to read the other logs or manage your system. The manager role also lowers the app's security rating in Home Assistant. Each is its own install, with its own sessions, home folder and config folder. You can run both, and the manager app uses port 49375 on your network rather than 49374.

## Opening OpenCode

Open **OpenCode** in the sidebar. The page there shows which OpenCode is running and signs you in with a link that works once, in a new tab. You don't need a password:

- **Open on this network** opens OpenCode at your Home Assistant host's address, on port 49374. It's shown while that port is mapped in the app's **Network** settings.
- **Open with remote access** opens OpenCode through OpenTunnel. It's shown when the `remote_access` option is on and the tunnel is up.

OpenCode's web app can't run inside the sidebar itself, so it always opens in its own tab. Home Assistant Link (formerly Home Assistant Cloud) reaches the sidebar page from anywhere, but not OpenCode's own port, so away from home use remote access.

### Pairing another device

To sign in from your phone, another computer or the OpenCode desktop app, select **Show a pairing code** on the sidebar page. Scan the QR code with the OpenCode app, or copy a link and open or paste it on the device. It's the same as running `opencode pair` on your own machine: the code works once and expires after a few minutes, so show a new one for each device.

## Options

### `server_password`

Optional. OpenCode always has a password, on your network and through remote access. Without this option, it makes a random one, and you sign in by pairing from the sidebar page. Set this only to use your own password instead, with the username `opencode`, for example from a client that can't pair.

### `remote_access`

Reaches OpenCode from anywhere through [OpenTunnel](https://github.com/anomalyco/opentunnel), at a private address that stays the same across restarts. The connection is encrypted end to end: the encryption ends inside the app, so OpenTunnel's relay only passes on traffic it can't read. OpenCode's password still applies, so the address alone doesn't let anyone in: pair your devices from the sidebar page, or sign in with `server_password` if you set one. Turning it off and on again gives a new address.

### `cors_origins`

Other web addresses allowed to call OpenCode from a browser, such as an OpenTunnel address you already use, `https://1a2b3c4d5e6f7a8b.abcd1234efgh.opentunnel.xyz`, or a reverse proxy of your own. Without it, an address OpenCode doesn't know can stop parts of the web app working, such as the terminal. Give origins only: the scheme and host, with a port if it isn't the default, and no path or trailing slash. Leave it empty to only allow OpenCode's own addresses. Origins set by hand with `opencode service set cors` are kept while this is empty.

### `home_assistant_mcp`

Connects OpenCode to Home Assistant's own [MCP server](https://www.home-assistant.io/integrations/mcp_server/), so the agent can read states and call actions as well as edit your configuration. It's on by default and shows in OpenCode as `home-assistant`.

It needs Home Assistant's **Model Context Protocol** integration (not **Model Context Protocol Client**): add it in **Settings** > **Devices & services**. Until you do, OpenCode shows the server as failed. The integration's options choose which tools the agent gets, and can make them read-only.

The app talks to Home Assistant through the Supervisor, with the app's own token, which OpenCode reads from the environment so it's never written to disk. That token can use Home Assistant's whole API as an admin, and anything the agent runs in the app can read it.

#### Other apps' MCP servers

Apps such as [Triage](https://github.com/timmo001/triage) can offer their own MCP server to Home Assistant. Once you've added it with Home Assistant's [Model Context Protocol Client](https://www.home-assistant.io/integrations/mcp/) integration, the app connects OpenCode to it too, through Home Assistant, named after the integration entry (for example `triage`). The list is read each time OpenCode starts, so after adding one, restart the app. This needs Home Assistant 2026.9 or newer.

### `music_assistant_token`

Optional. Connects the agent to [Music Assistant](https://www.music-assistant.io)'s app, so it can browse your library and control playback. Music Assistant has to be running as an app on the same Home Assistant.

To set it up:

1. In Music Assistant, open **Settings** > **Profile** and create a token under **Long-lived access tokens**. See [Music Assistant's profile settings](https://www.music-assistant.io/settings/profile/). These tokens last a year, so make a new one when it runs out.
2. Paste it into this option and restart the app.

The agent uses [Music Assistant's API](https://www.music-assistant.io/api/) from the shell, with the address and token in `MUSIC_ASSISTANT_URL` and `MUSIC_ASSISTANT_TOKEN`.

#### Music Assistant's MCP server

Music Assistant can also run an MCP server, which gives the agent tools for your library, players and queues. To use it:

1. In Music Assistant, open **Settings** > **Plugins** > **Add a plugin** and add **FastMCP Server**. See [the plugin's documentation](https://www.music-assistant.io/plugins/fastmcp-server/).
2. In the plugin's permissions, allow what the agent may do. Only read-only library access is on by default, so turn on playback and queue control if you want those.
3. Restart this app. It checks for the plugin on every start and connects OpenCode to it as `music-assistant`, with the same token. You don't need the plugin's Connect Wizard.

The plugin is still experimental in Music Assistant. Without it, the agent uses the API.

### `ha_bridge`

Runs [ha-bridge](https://ha-bridge.timmo.dev), so the agent can read and control Home Assistant from the shell: read and watch states, call actions, render templates, read and change automations and scripts, and read Home Assistant's logs. It keeps one connection to Home Assistant, through the Supervisor with the app's token, for every `ha-bridge` command. It's on by default, comes with the app and updates with the other preinstalled tools. Its own skills, `ha-bridge-cli` and `home-assistant`, come with each ha-bridge version, so they always match it.

Which logs it can read depends on which of the two apps you run. See [The two apps](#the-two-apps).

### `system_packages`

Debian packages to install with apt. The container's filesystem is reset on every start, so they're installed again each time. That happens in the background once OpenCode is up, so it doesn't hold up the start, but a package isn't there until the app's log says the install has finished: remove any you don't need. A package that can't be found is skipped, and shown on the sidebar page and in the app's log.

The default list is `build-essential`, `dnsutils`, `ffmpeg`, `iputils-ping`, `rsync`, `sqlite3` (for Home Assistant's history database) and `tmux`.

### `tools`

Developer tools to install with [mise](https://mise.jdx.dev), as `name`, `name@version` or `backend:name@version`, such as `go@1.27` or `npm:prettier@3`. They're installed once and kept between restarts. Without a version, you get the newest, and the app keeps it up to date. A tool mise can't install is skipped, and shown on the sidebar page and in the app's log.

The default list is `actionlint`, `bat`, `deno`, `eza`, `fd`, `fzf`, `go`, `hyperfine`, `just`, `lazygit`, `npm:skills`, `pitchfork`, `pnpm`, `pypi:yamllint`, `python`, `ruff`, `shellcheck`, `shfmt`, `starship`, `uv`, `watchexec`, `yq` and `zoxide`. These come with the app, so they're ready without downloading anything. Remove any you don't want and they're gone on the next start.

## Preinstalled tools

These come with the app and are always there, whatever the `tools` option says:

- OpenCode 2
- Node.js, Bun and [aube](https://github.com/aubepkg/aube), which installs npm tools
- The GitHub CLI (`gh`), `jq`, ripgrep (`rg`) and Neovim (`nvim`), which Git and other tools open for editing
- [ha-bridge](https://ha-bridge.timmo.dev), which the app runs while the `ha_bridge` option is on
- From Debian: `git`, `curl`, `ssh`, `less`, `unzip`, `xz` and bash completion

## The terminal

OpenCode's terminal runs bash with tab completion that cycles through matches, and history that's kept in `/data/home` and searched with the arrow keys. Tools from the default `tools` list add more when they're installed:

- `starship`: the [Starship](https://starship.rs) prompt
- `eza`: `ls`, `lsa`, `lt` and `lta`
- `zoxide`: `cd` that also jumps to folders you've used
- `fzf` and `bat`: `Ctrl+R` searches your history, and `ff` finds a file with a preview
- `lazygit`: `lg`

There are short Git aliases too, such as `g` for `git`. To change the prompt, add `/data/home/.config/starship.toml`. For your own aliases, add `/data/home/.bash_profile`, which the terminal reads after the app's defaults.

## Updates

OpenCode and the tools update themselves, without waiting for an app release:

- When the app starts, and every 12 hours. An OpenCode update found on the 12-hour check runs from the next restart, so OpenCode isn't restarted under you.
- On demand with **Update and restart** on the sidebar page, or `/app-update` in OpenCode. These restart OpenCode straight away when it changed, which stops anything running in any session. ha-bridge restarts when it changed too, which ends any `ha-bridge` watch that's running.

OpenCode stays on version 2. A new major version comes with an app update.

## Where things live

| Path                                                    | What                                                                 | Kept               |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| `/data/home`                                            | Your home folder: projects, Git and GitHub sign-ins, OpenCode's data | Yes, and backed up |
| `/homeassistant`                                        | Home Assistant's configuration, which the agent can edit             | Yes                |
| `/share`                                                | Home Assistant's shared folder                                       | Yes                |
| The app's config folder (`addon_configs/<id>_opencode`) | Your `opencode.json`, `AGENTS.md`, `skills` and `mise.toml`          | Yes, and backed up |

The app's config folder is linked into place on every start, so you can edit it with the File editor or Samba apps. Files that are missing are created again with a starting point.

## What the agent knows about the app

The app tells the agent about its container in every session: what's kept across restarts and where things live. For the rest, such as which tool layer to use, how to add system packages and how updates work, the agent loads the built-in `opencode-app` skill. Two more cover the connections: `opencode-app-home-assistant` for Home Assistant's API and MCP servers, and `opencode-app-music-assistant` for Music Assistant. They all come with the app and change with its releases. ha-bridge's own skills come with ha-bridge, while its option is on. The agent asks you rather than updating or restarting OpenCode or the app itself.

Your own `AGENTS.md` in the app's config folder is for your instructions, on top of these.

## Tool layers

mise reads its config in layers, so the app's tools and yours are kept apart:

| Layer              | File                                              | Changed by                                         |
| ------------------ | ------------------------------------------------- | -------------------------------------------------- |
| Preinstalled tools | `/etc/mise/config.toml`                           | App releases. Reset on every start                 |
| The `tools` option | `/data/home/.config/mise/conf.d/app-options.toml` | The app, from the option. Rewritten on every start |
| Your own tools     | `mise.toml` in the app's config folder            | You, or the agent with `mise use -g`               |
| A project's tools  | The project's own `mise.toml`                     | The project                                        |

A later layer can pick a different version of a preinstalled tool, such as an older Node.js for one project. OpenCode's own server always runs the preinstalled OpenCode, so no layer can break it, and a restart puts the preinstalled layer back.

## Signing in to providers and GitHub

Connect a model provider from OpenCode with `/connect`. See [OpenCode's providers](https://opencode.ai/docs/providers).

For GitHub, ask the agent to run `gh auth login`, or run it from OpenCode's terminal. The sign-in is kept in `/data/home`.

## Git

Git comes set up with some defaults: new repositories start on `main`, commit messages open in Neovim, `git pull` rebases, `git push` sets up the remote branch, fetches prune deleted branches, conflicts show the common ancestor (`zdiff3`), branches list newest first, and resolved conflicts are remembered (`rerere`). There are short aliases such as `git st` and `git lg` too. Once you've signed in with `gh auth login`, Git uses that sign-in to push and pull from GitHub over HTTPS, and the app sets your Git name and email from your GitHub account on its next start, if they aren't set already, using GitHub's noreply address when your email is private. They and anything else you set with `git config --global` go in `/data/home/.gitconfig`, which is kept and wins over the defaults.

lazygit adds two keys in the branches panel: `Ctrl+B` cleans up merged branches with [gh-poi](https://github.com/seachicken/gh-poi), which it installs the first time, and `Ctrl+F` fetches and rebases onto the default branch, from `upstream` when there is one. Your own `/data/home/.config/lazygit/config.yml` replaces these.

## Reporting a problem

Run `/app-feedback` in OpenCode, with a few words on what went wrong or what you'd like. The agent gathers the details, checks for an existing issue and shows you a draft. It only opens the issue on GitHub once you say so.

## Documentation

See [OpenCode's documentation](https://opencode.ai/docs).
