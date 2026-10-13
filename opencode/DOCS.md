# OpenCode

An AI coding agent for your Home Assistant setup, powered by [OpenCode](https://opencode.ai). The app runs OpenCode 2's server, keeps it and its tools up to date, and opens it from the Home Assistant sidebar.

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

### `system_packages`

Debian packages to install with apt. The container's filesystem is reset on every start, so they're installed again each time. That happens in the background once OpenCode is up, so it doesn't hold up the start, but a package isn't there until the app's log says the install has finished: remove any you don't need. A package that can't be found is skipped, and shown on the sidebar page and in the app's log.

The default list is `build-essential`, `dnsutils`, `ffmpeg`, `iputils-ping`, `rsync`, `sqlite3` (for Home Assistant's history database) and `tmux`.

### `tools`

Developer tools to install with [mise](https://mise.jdx.dev), as `name`, `name@version` or `backend:name@version`, such as `go@1.27` or `npm:prettier@3`. They're installed once and kept between restarts. Without a version, you get the newest, and the app keeps it up to date. A tool mise can't install is skipped, and shown on the sidebar page and in the app's log.

The default list is `actionlint`, `bat`, `deno`, `fd`, `fzf`, `go`, `hyperfine`, `just`, `lazygit`, `npm:skills`, `pitchfork`, `pnpm`, `pypi:yamllint`, `python`, `ruff`, `shellcheck`, `shfmt`, `uv`, `watchexec` and `yq`. Remove any you don't want.

## Preinstalled tools

These come with the app and are always there, whatever the `tools` option says:

- OpenCode 2
- Node.js, Bun and [aube](https://github.com/aubepkg/aube), which installs npm tools
- The GitHub CLI (`gh`), `jq` and ripgrep (`rg`)
- From Debian: `git`, `curl`, `ssh`, `less`, `unzip` and `xz`

## Updates

OpenCode and the tools update themselves, without waiting for an app release:

- When the app starts, and every 12 hours. An OpenCode update found on the 12-hour check runs from the next restart, so OpenCode isn't restarted under you.
- On demand with **Update and restart** on the sidebar page, or `/app-update` in OpenCode. These restart OpenCode straight away when it changed, which stops anything running in any session.

OpenCode stays on version 2. A new major version comes with an app update.

## Where things live

| Path                                                    | What                                                                 | Kept               |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| `/data/home`                                            | Your home folder: projects, Git and GitHub sign-ins, OpenCode's data | Yes, and backed up |
| `/homeassistant`                                        | Home Assistant's configuration, which the agent can edit             | Yes                |
| `/share`                                                | Home Assistant's shared folder                                       | Yes                |
| The app's config folder (`addon_configs/<id>_opencode`) | Your `opencode.json`, `AGENTS.md`, `skills` and `mise.toml`          | Yes, and backed up |

The app's config folder is linked into place on every start, so you can edit it with the File editor or Samba apps. Files that are missing are created again with a starting point.

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

## Documentation

See [OpenCode's documentation](https://opencode.ai/docs).
