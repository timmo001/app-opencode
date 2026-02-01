# Home Assistant OpenCode Add-on

AI coding agent with web interface powered by [OpenCode](https://opencode.ai).

## About

This add-on runs OpenCode as a headless server, providing a web-based interface for AI-assisted coding. OpenCode is an open source AI coding agent that helps with software engineering tasks.

## Installation

1. Add this repository to your Home Assistant add-on store
2. Install the OpenCode add-on
3. Start the add-on
4. Access OpenCode via the sidebar or direct port access

## Configuration

### Option: `ssl`

Enables/disables SSL (HTTPS) for direct port access. When enabled, you must provide valid certificate files.

### Option: `certfile`

The certificate file to use for SSL. The file must exist in the `/ssl/` directory.

### Option: `keyfile`

The private key file to use for SSL. The file must exist in the `/ssl/` directory.

### Option: `server_password`

Optional password to protect the OpenCode server. When set, HTTP Basic authentication will be required with username `opencode`.

### Option: `leave_front_door_open`

When enabled, disables authentication for direct port access. Use with caution.

## Access

### Via Home Assistant Sidebar (Ingress)

Click the OpenCode icon in the Home Assistant sidebar to access the web interface through ingress.

### Via Direct Port

Access OpenCode directly at `http://your-ha-ip:4096` (or `https://` if SSL is enabled).

## Setting Up LLM Providers

After starting the add-on, you'll need to configure your LLM provider API keys in the OpenCode web interface:

1. Open OpenCode via the sidebar
2. Run the `/connect` command
3. Select your preferred provider
4. Enter your API key

For more information about providers, visit [opencode.ai/docs/providers](https://opencode.ai/docs/providers).

## Documentation

For full OpenCode documentation, visit [opencode.ai/docs](https://opencode.ai/docs).
