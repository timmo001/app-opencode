---
name: opencode-app-home-assistant
description: How the OpenCode Home Assistant app connects to Home Assistant - its MCP server, the MCP servers of other apps and services that Home Assistant connects to with its Model Context Protocol Client integration, and Home Assistant's REST and WebSocket APIs through the Supervisor. Load before reading states, calling actions, using another app's MCP tools through Home Assistant, or calling Home Assistant's API from the shell.
---

# Home Assistant from the OpenCode app

The app reaches Home Assistant through the Supervisor's proxy at `http://supervisor/core`, signed in with `SUPERVISOR_TOKEN` from the environment. That token is an admin token for Home Assistant's whole API: never print it, log it or write it to a file. Pass it as `$SUPERVISOR_TOKEN` in commands so its value never shows.

Prefer the MCP tools when they cover what you need. Use the API for what they don't, such as history or config entries.

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

The app doesn't have the Supervisor's `hassio_api` access, so it can't list, start or configure other apps. Ask the user to do those from Home Assistant.

## Changing Home Assistant's configuration

Home Assistant's configuration is at `/homeassistant`, and it's the user's live setup. Check before editing, then validate with `curl -sS -X POST -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/core/api/config/core/check_config`, which answers `{"result": "valid"}` or the errors. Ask the user before reloading or restarting Home Assistant.
