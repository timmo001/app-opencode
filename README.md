# Home Assistant OpenCode App

AI coding agent with web interface powered by OpenCode.

## About

This app runs [OpenCode](https://opencode.ai) as a web-based AI coding agent for Home Assistant. OpenCode provides a powerful interface for AI-assisted coding and automation.

## Features

- Web-based interface accessible via Home Assistant sidebar
- Direct port access on port 4096
- Optional server password authentication
- Full access to Home Assistant configuration and apps

## Installation

1. Add this repository to your Home Assistant app store
2. Install the OpenCode app
3. Configure your LLM provider API keys in OpenCode
4. Start the app

## Configuration

| Option            | Description                                 |
| ----------------- | ------------------------------------------- |
| `ssl`             | Enable/disable SSL for direct port access   |
| `certfile`        | SSL certificate file (in /ssl/)             |
| `keyfile`         | SSL private key file (in /ssl/)             |
| `server_password` | Optional password for server authentication |

## Documentation

For more information about OpenCode, visit [opencode.ai/docs](https://opencode.ai/docs).
