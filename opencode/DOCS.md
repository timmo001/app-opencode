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

### Option: `repositories`

An array of GitHub repositories to clone on startup. Repositories should be specified in the format `owner/repo` (e.g., `octocat/Hello-World`).

Example configuration:

```yaml
repositories:
  - octocat/Hello-World
```

Repositories are cloned to `/data/repos/<repo-name>` using the GitHub CLI (`gh`).

## GitHub Authentication

To clone private repositories or push changes, you can use git credential storage:

1. Open OpenCode at `http://your-ha-ip:4096`
2. Run `git config --global credential.helper store` in the terminal
3. When prompted during git operations, enter your GitHub username and personal access token (PAT)

Your git configuration is persisted to `/data/.gitconfig`, so it will survive container restarts.

To create a personal access token, visit [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

## Setting Up LLM Providers

After starting the app, you'll need to configure your LLM provider API keys in the OpenCode web interface:

1. Open OpenCode via the sidebar
2. Run the `/connect` command
3. Select your preferred provider
4. Enter your API key

For more information about providers, visit [opencode.ai/docs/providers](https://opencode.ai/docs/providers).

## Documentation

For full OpenCode documentation, visit [opencode.ai/docs](https://opencode.ai/docs).
