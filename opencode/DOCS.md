# Home Assistant OpenCode App

AI coding agent with web interface powered by [OpenCode](https://opencode.ai).

## About

This app runs OpenCode as a headless server, providing a web-based interface for AI-assisted coding. OpenCode is an open source AI coding agent that helps with software engineering tasks.

## Installation

1. Add this repository to your Home Assistant app store
2. Install the OpenCode app
3. Start the app
4. Access OpenCode at `http://your-ha-ip:4096`

## Configuration

### Option: `server_password`

Optional password to protect the OpenCode server. When set, authentication will be required to access the server.

## Access

### Via Home Assistant Sidebar (Ingress)

Click the OpenCode icon in the Home Assistant sidebar to access the web interface through ingress.

### Via Direct Port

Access OpenCode directly at `http://your-ha-ip:4096`.

## Setting Up LLM Providers

After starting the app, you'll need to configure your LLM provider API keys in the OpenCode web interface:

1. Open OpenCode via the sidebar
2. Run the `/connect` command
3. Select your preferred provider
4. Enter your API key

For more information about providers, visit [opencode.ai/docs/providers](https://opencode.ai/docs/providers).

## Documentation

For full OpenCode documentation, visit [opencode.ai/docs](https://opencode.ai/docs).
