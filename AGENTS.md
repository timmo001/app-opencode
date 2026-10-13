# AGENTS.md - OpenCode Home Assistant app

Guidelines for AI coding agents working in this repository.

## Project overview

A Home Assistant app that runs OpenCode 2. The image is built from the root `Dockerfile` and published, prebuilt for amd64 and aarch64, to `ghcr.io/timmo001/app-opencode`. The Supervisor pulls it; it never builds it.

- `src/` is the entrypoint, an Effect v4 program compiled with Bun to `/usr/local/bin/opencode-app`. It prepares `/data/home`, installs the `tools` option, keeps tools up to date, runs `opencode serve --service`, serves the sidebar page on the ingress port and then installs the `system_packages` option in the background.
- `src/plugin.ts` is an OpenCode plugin, bundled with `effect` and `@opencode/plugin` external, that adds `/app-update`. It talks to the entrypoint over the control socket.
- `image/mise.toml` is the image's built-in tools, copied to `/etc/mise/config.toml`.
- `opencode/` holds the app's metadata only: `config.yaml`, `DOCS.md`, `translations/` and the icons.

There's no s6-overlay, no bashio and no hassio-addons base: Debian provides the system and mise everything else.

## Commands

```sh
mise run check      # Oxlint (type aware, no warnings allowed), tsc, Prettier and yamllint
mise run build      # dist/opencode-app and dist/plugin.js
mise run format     # Prettier
```

There's no Docker locally. CI builds the image for both architectures without pushing.

## Code style

- Use the `effect` and `effect-service-design` skills. Each module is a `Context.Service` with a `layer`, errors are `Schema.TaggedError`, and modules end with `export * as Name from './Name.js'`.
- Child processes go through `Command.run` or the Effect `ChildProcessSpawner`, with arguments as an array. Option values never reach a shell.
- Oxlint uses `@timmo001/oxlint-rules` with `maxWarnings: 0`.
- Pin JavaScript dependencies to exact versions.
- YAML starts with `---`, uses 2 spaces and block-style lists.

## Key conventions

- Persistent data lives in `/data`; `HOME` is `/data/home`. The user's OpenCode config (`opencode.json`, `AGENTS.md`, `skills`, `mise.toml`) lives in the app's config folder at `/config` and is linked into `~/.config` on every start.
- Built-in tools are installed into mise's system folders in the image. Upgrades go into `$HOME/.local/share/mise` with `mise install tool@version`, never `mise upgrade`, which would write into the image and be lost.
- The server's OpenCode is resolved from the system config alone, so the user's mise layers can't change it.
- OpenCode stays on major version 2 in `image/mise.toml`; a new major needs a client and plugin built for it.

## Skills

| Skill                     | Use when                                        |
| ------------------------- | ----------------------------------------------- |
| `app-opencode-dockerfile` | Changing the Dockerfile or the image's tools    |
| `app-opencode-review`     | Reviewing, cleaning up and testing a changeset  |
| `app-opencode-release`    | Versioning and releasing the app and its images |
