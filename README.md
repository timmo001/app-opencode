# OpenCode for Home Assistant

A Home Assistant app that runs [OpenCode](https://opencode.ai) 2, an AI coding agent, with your Home Assistant configuration to hand.

- Opens OpenCode from the Home Assistant sidebar, signed in with a link that works once
- Optional remote access through OpenTunnel
- OpenCode and its tools update themselves, without waiting for an app release
- Debian packages and [mise](https://mise.jdx.dev) tools from the app's options

The images are prebuilt for amd64 and aarch64 on GitHub's container registry.

## Installation

[![Add this repository to your Home Assistant.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Ftimmo001%2Fapp-opencode)

1. Add this repository to your Home Assistant app store, or [add all my apps at once](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Ftimmo001%2Fhome-assistant-apps). Add one or the other, not both: Home Assistant treats them as different apps, so moving between them starts with empty settings and data.
2. Install the OpenCode app and start it.
3. Open **OpenCode** in the sidebar.

See [the app's documentation](opencode/DOCS.md) for the options, the preinstalled tools and where your files live.

## Development

The app is a small Effect program, in `src/`, that prepares the home folder, installs tools, runs OpenCode's server and serves the sidebar page. `src/plugin.ts` is the OpenCode plugin that adds `/app-update`.

```sh
mise run check   # Oxlint, TypeScript, Prettier and yamllint
mise run build   # The entrypoint binary and the plugin, in dist/
```

## Licence

[Apache-2.0](LICENSE)
