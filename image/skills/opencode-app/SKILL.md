---
name: opencode-app
description: How the OpenCode Home Assistant app's container works - where files live and what survives a restart, the mise tool layers, adding tools and system packages, Home Assistant's MCP server, and updating or restarting OpenCode and the app. Load before installing a tool or package, changing the app's or OpenCode's config, or when an update or restart comes up.
---

# The OpenCode Home Assistant app

You're running inside the OpenCode app for Home Assistant: a Debian container that the Home Assistant Supervisor runs as root. The app starts OpenCode's server and keeps it and its tools up to date. The user manages the app from its page in Home Assistant (**Settings** > **Apps** > **OpenCode**), where its options, log and restart button are.

## What survives a restart

The container's filesystem is reset every time the app starts. Only these folders are kept:

| Path                   | What                                                                             | Notes                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/data/home` (`$HOME`) | Projects, Git and GitHub sign-ins, OpenCode's data, tools installed at runtime   | In the app's backups. Keep projects here                            |
| `/homeassistant`       | Home Assistant's configuration                                                   | The user's live config: check before editing, and validate it after |
| `/share`               | Home Assistant's shared folder                                                   | Shared with other apps                                              |
| `/config`              | The app's config folder, which the user edits with the File editor or Samba apps | In the app's backups                                                |

Anything written elsewhere, such as `/usr`, `/etc` or `/opt`, is gone after a restart.

`/config` holds the user's own `opencode.json`, `AGENTS.md`, `skills` and `mise.toml`. They're linked into `~/.config/opencode` and `~/.config/mise` on every start, so editing either path changes the same file. A missing one is created again on the next start.

This skill and the app's plugin, which adds `/app-update` and `/app-feedback`, come with the app and change with app releases. Don't edit them; add the user's own skills to `/config/skills` instead.

## Tools

Developer tools come from [mise](https://mise.jdx.dev), in layers, each overriding the one before:

| Layer                  | File                                               | Changed by                                         |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Preinstalled tools     | `/etc/mise/config.toml`                            | App releases. Reset on every start                 |
| The `tools` app option | `~/.config/mise/conf.d/app-options.toml`           | The app, from the option. Rewritten on every start |
| The user's own tools   | `/config/mise.toml` (`~/.config/mise/config.toml`) | `mise use -g <tool>`                               |
| A project's tools      | The project's `mise.toml`                          | The project                                        |

- To add a tool for the user, run `mise use -g <tool>`. It's installed into `$HOME`, so it's kept.
- For a tool only one project needs, add it to that project's `mise.toml` with `mise use <tool>` in the project.
- Editing `/etc/mise/config.toml` or `app-options.toml` does nothing lasting. If a tool should be one of the app's, suggest the user adds it to the `tools` option.
- Don't run `mise upgrade`: it writes into the image, which is lost on restart. The app keeps its own tools up to date. For the user's tools, `mise install <tool>@<version>` or `mise use -g <tool>@<version>`.
- OpenCode's server always runs the preinstalled OpenCode 2, whatever the layers say, so changing the `npm:@opencode/cli` version in a layer doesn't change the server.

## System packages

`apt-get install` works, as root, but the package is gone after a restart. For a package that should stay, suggest the user adds it to the `system_packages` app option; the app installs those in the background after each start, so check the app's log if one seems missing. Prefer a mise tool when one exists, since it's kept without reinstalling.

## Home Assistant

With the `home_assistant_mcp` option on (the default), OpenCode has an MCP server called `home-assistant` for reading states and calling actions. It needs Home Assistant's **Model Context Protocol** integration; if the server shows as failed, ask the user to add it in **Settings** > **Devices & services**.

`SUPERVISOR_TOKEN` in the environment is an admin token for Home Assistant's API. Never print it, log it or write it to a file.

## Updating and restarting

Never update or restart OpenCode or the app yourself, and never stop or kill OpenCode's server or the `opencode-app` process: either ends every session, including this one. When one is needed, say why and ask the user to do it:

- **Updating OpenCode and the app's tools:** the user runs `/app-update` in OpenCode, or selects **Update and restart** on the app's sidebar page. Both restart OpenCode straight away if it changed. The app also checks on start and every 12 hours.
- **Applying a change to the app's options, or getting a clean container:** the user restarts the app from its page in Home Assistant.
- **A new app version:** the user updates the app in Home Assistant. A new OpenCode major version only arrives this way.
- **Changes to `opencode.json`, skills or `AGENTS.md`:** OpenCode picks them up by itself. If one doesn't take effect, ask the user to restart the app.

## Reporting a problem with the app

If something about the app itself is broken, suggest the user runs `/app-feedback`.
