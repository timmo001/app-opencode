# Home Assistant OpenCode Environment

You are running inside a Home Assistant add-on container. This environment is sandboxed to the `/data` directory.

## Directory Structure

- `/data` - Your workspace (persistent storage)
- All files you create or modify must be within `/data`
- Access to paths outside `/data` is denied

## Available Tools

Common CLI tools are available:

- `git` - Version control
- `curl`, `wget` - HTTP requests
- `jq` - JSON processing
- `ripgrep` (`rg`), `grep` - Search
- `fd-find` (`fdfind`) - File finding
- `sed`, `awk` - Text processing
- `tar`, `zip`, `unzip`, `gzip`, `xz` - Archives

## Limitations

- No access to Home Assistant configuration files
- No access to the host system
- No package installation (apt, npm, etc.)
- No network services can be started

## Tips

- Clone repositories into `/data`
- Use `/data` for all project files
- The workspace persists across restarts
