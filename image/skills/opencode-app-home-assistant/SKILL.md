---
name: opencode-app-home-assistant
description: How the OpenCode Home Assistant app connects to Home Assistant - its MCP server, the MCP servers of other apps and services that Home Assistant connects to with its Model Context Protocol Client integration, the ha-bridge CLI the app runs, the Supervisor's API as far as the app's role allows, and Home Assistant's REST and WebSocket APIs through the Supervisor. Load before reading states, calling actions, reading logs, using another app's MCP tools through Home Assistant, or calling Home Assistant's or the Supervisor's API from the shell.
---

# Home Assistant from the OpenCode app

The app reaches Home Assistant through the Supervisor's proxy at `http://supervisor/core`, signed in with `SUPERVISOR_TOKEN` from the environment. That token is an admin token for Home Assistant's whole API: never print it, log it or write it to a file. Pass it as `$SUPERVISOR_TOKEN` in commands so its value never shows.

Prefer the MCP tools when they cover what you need. For the rest, such as history, logs, watching states or changing automations, use `ha-bridge` from the shell, and the API only for what neither has.

## ha-bridge

With the `ha_bridge` app option on (the default), the app runs `ha-bridge serve`, which keeps one connection to Home Assistant through the Supervisor. Every other `ha-bridge` command talks to it over the socket in `HA_BRIDGE_SOCK`, so it needs no URL or token. Load the `ha-bridge-cli` skill before using it, and `home-assistant` before writing automations or explaining how Home Assistant behaves; both come with the installed ha-bridge. `ha-bridge --help` is the authority on its commands.

- Check it's connected with `ha-bridge get sun.sun`. If the socket is missing, the option is off or it failed to start: ask the user to check the app's log.
- Don't run `ha-bridge setup`, start another `ha-bridge serve` or write `~/.config/ha-bridge/config.yml`. A config file would replace the Supervisor connection.
- Which logs it reads depends on the app's Supervisor role. **OpenCode** has the `homeassistant` role: Core's log and journal. **OpenCode (manager access)** has `manager`: the Supervisor, host, plugin and app logs too. A log command that fails with a permission error needs the manager app; tell the user rather than working around it.

## MCP servers

With the `home_assistant_mcp` app option on (the default), OpenCode connects to these when it starts:

| Server                                 | What                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `home-assistant`                       | Home Assistant's own MCP server: states and actions for the entities the user exposed. Needs the **Model Context Protocol** integration |
| One per MCP server Home Assistant uses | Named after its **Model Context Protocol Client** integration entry. Home Assistant passes the tool calls through to it                 |

- If `home-assistant` shows as failed, ask the user to add the [Model Context Protocol](https://www.home-assistant.io/integrations/mcp_server/) integration in **Settings** > **Devices & services**. Its options choose which tools you get, and can make them read-only.
- To reach another MCP server, the user adds it with the [Model Context Protocol Client](https://www.home-assistant.io/integrations/mcp/) integration (Home Assistant offers apps that announce one as discovered), then restarts this app. The list is only read when OpenCode starts, and needs Home Assistant 2026.9 or newer.
- Don't add these servers to `opencode.json` by hand: the app does it on every start, and the token never reaches a file that way.

## REST API

```sh
curl -sS -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/core/api/states/sun.sun
curl -sS -H "Authorization: Bearer $SUPERVISOR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"entity_id": "light.kitchen"}' http://supervisor/core/api/services/light/turn_on
```

See [Home Assistant's REST API](https://developers.home-assistant.io/docs/api/rest/) for the rest.

## WebSocket API

Connect to `ws://supervisor/core/websocket`. The proxy sends `auth_required`; answer with `{"type": "auth", "access_token": "<SUPERVISOR_TOKEN>"}` and wait for `auth_ok`, then send commands with increasing `id`s. Use it for what REST doesn't have, such as the entity, device and area registries (`config/entity_registry/list`) or subscribing to events. See [Home Assistant's WebSocket API](https://developers.home-assistant.io/docs/api/websocket/).

## The Supervisor's own API

The app has the Supervisor API at `http://supervisor`, with the same token, as far as its role allows. Check the role with `curl -sS -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/addons/self/info | jq -r .data.hassio_role`.

- `homeassistant` (the **OpenCode** app): only the `/core` endpoints, Home Assistant's own. Ask the user to list, start or configure other apps from Home Assistant.
- `manager` (the **OpenCode (manager access)** app): apps, the host, backups and every log as well. These change the user's whole system: ask before starting, stopping, updating or configuring anything, or rebooting.

## Changing Home Assistant's configuration

Home Assistant's configuration is at `/homeassistant`, and it's the user's live setup. Check before editing, then validate with `curl -sS -X POST -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/core/api/config/core/check_config`, which answers `{"result": "valid"}` or the errors. Ask the user before reloading or restarting Home Assistant.
