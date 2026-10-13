---
name: app-opencode-dockerfile
license: Apache-2.0
compatibility: Designed for the app-opencode repository, whose image CI builds with Docker BuildKit for amd64 and aarch64.
description: Write and review the OpenCode Home Assistant app's Dockerfile and the tools its image ships - the Debian base, the Bun build stage, mise system installs from image/mise.toml, digest pins and hadolint. Use when changing the root Dockerfile or image/mise.toml, adding a system package or built-in tool, or when the image fails to build for amd64 or aarch64.
---

# The app-opencode image

The root `Dockerfile` builds the image the Supervisor pulls. CI builds it for both architectures with the shared `build-container-image.yml` workflow, which also adds the `io.hass.*` labels, so the Dockerfile has no `LABEL`, `BUILD_FROM` or `build.yaml`. Check anything version-specific against the app docs (`docs/apps/configuration.md` and `docs/apps/publishing.md` in the `dev-docs` reference).

## Stages

1. `build`: `oven/bun`, which installs the locked packages and runs `bun run build`. It compiles `src/main.ts` to `dist/opencode-app` and bundles `src/plugin.ts` to `dist/plugin.js` with `effect` and `@opencode/plugin` external, since OpenCode gives plugins its own copies.
2. `mise`: `jdxcode/mise`, only to copy the `mise` binary.
3. `app`: `debian:trixie-slim`, the image itself. It runs as root, which the Supervisor needs for `/data` and the app needs for apt.

There's no s6-overlay or bashio. The entrypoint is `/usr/local/bin/opencode-app`, which handles signals and restarts OpenCode itself, and Docker's default init reaps the processes the agent starts, so `config.yaml` has no `init: false`.

## System packages and tools

- Debian provides the base system only: what OpenCode and most agent work expect on any machine (`git`, `curl`, `ssh`, and so on). Users add more with the `system_packages` option, so keep the list short. `DL3008` is ignored for this one `apt-get install`, since Debian's packages move with the pinned base digest.
- Everything else comes from mise. `image/mise.toml` is copied to `/etc/mise/config.toml`, mise's system config, and installed with `mise install --system` into `/usr/local/share/mise`. Install Node.js and aube first, since npm tools install through them.
- Built-in tools use `latest`, except OpenCode, which stays on major `2` because the entrypoint's client and the plugin are built against it. The app updates them at runtime into `$HOME`, so a release isn't needed for a new tool version.
- When adding a built-in tool, also list it under **Preinstalled tools** in `opencode/DOCS.md`.

## Pins

- Pin every `FROM` to a tag and digest. Renovate updates both.
- `HOME` is `/data/home`, so build steps that need a home set `HOME=/root` and remove its caches in the same layer.
- `PATH` puts the user's mise shims before the system ones, so runtime upgrades win.

## Checking

There's no Docker locally. Check the parts that don't need it (`mise run check`, `mise run build`, and mise reading `image/mise.toml` with `MISE_SYSTEM_CONFIG_DIR` pointed at a copy), then rely on CI, which builds both architectures and runs a smoke test of the amd64 image.

## hadolint

Fix findings rather than ignoring them. Ignore with a reason only where the rule can't apply.
