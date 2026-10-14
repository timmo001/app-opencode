---
name: opencode-app-music-assistant
description: How the OpenCode Home Assistant app connects to Music Assistant - its MCP server when that plugin is on, and its API from the shell with MUSIC_ASSISTANT_URL and MUSIC_ASSISTANT_TOKEN. Load before searching music, playing, queueing or controlling players through Music Assistant, or when the user asks to connect it.
---

# Music Assistant from the OpenCode app

The app connects to Music Assistant's app when the user sets the `music_assistant_token` app option. Then the environment has:

- `MUSIC_ASSISTANT_URL`: Music Assistant's server, `http://172.30.32.1:8095`. Its app runs on the host's network, which this app reaches through the Supervisor's gateway.
- `MUSIC_ASSISTANT_TOKEN`: the user's long-lived token. Never print it, log it or write it to a file; pass it as `$MUSIC_ASSISTANT_TOKEN`.

If they're missing, the option isn't set. Guide the user through it:

1. In Music Assistant, open **Settings** > **Profile** and create a token under **Long-lived access tokens** ([Music Assistant's profile settings](https://www.music-assistant.io/settings/profile/)). Long-lived tokens last a year.
2. Paste it into this app's `music_assistant_token` option on its page in Home Assistant (**Settings** > **Apps** > **OpenCode** > **Configuration**).
3. Restart this app.

## MCP server

When Music Assistant's **FastMCP Server** plugin is on, OpenCode has a `music-assistant` MCP server. The app checks for it on every start. Prefer its tools when they cover the task.

If it's missing and the user wants it, guide them through [the plugin's setup](https://www.music-assistant.io/plugins/fastmcp-server/):

1. In Music Assistant, open **Settings** > **Plugins** > **Add a plugin** and add **FastMCP Server**. Leave **Require authentication** on.
2. In the plugin's permissions, allow what the agent should do. Only read-only library access is on by default, so playback and queue control need turning on.
3. Restart this app so it picks the server up.

The token from the app option works for the MCP server too; the plugin's Connect Wizard isn't needed.

Don't add it to `opencode.json` by hand: the app does it on every start.

## API

Without the MCP server, or for what its tools don't cover, call [Music Assistant's API](https://www.music-assistant.io/api/). Every command is a `POST` to `/api`:

```sh
curl -sS -H "Authorization: Bearer $MUSIC_ASSISTANT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"message_id": "1", "command": "players/all"}' "$MUSIC_ASSISTANT_URL/api"
curl -sS -H "Authorization: Bearer $MUSIC_ASSISTANT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"message_id": "2", "command": "music/search", "args": {"search_query": "Daft Punk", "limit": 5}}' \
  "$MUSIC_ASSISTANT_URL/api"
```

The reply is the command's result as JSON, or an error status with a message.

- Music Assistant documents its own commands and their arguments. Read `$MUSIC_ASSISTANT_URL/api-docs/commands.json` rather than guessing a command's name or arguments; it's large, so filter it with `jq`.
- For events, such as following what's playing, use the WebSocket API at `$MUSIC_ASSISTANT_URL/ws`: send `{"message_id": "1", "command": "auth", "args": {"token": "..."}}` first, then commands in the same shape.
- Ask before anything that's loud or hard to undo, such as playing on a speaker, changing volume, or editing or deleting library items and playlists.
