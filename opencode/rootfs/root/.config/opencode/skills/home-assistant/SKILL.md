# Home Assistant OpenCode Environment

Manage the sandboxed Home Assistant add-on environment for OpenCode.

## When This Skill MUST Be Used

**ALWAYS invoke this skill when:**

- The user asks about what they can do in this environment
- The user tries to access files outside `/data`
- The user asks about installing packages or software
- The user asks about Home Assistant configuration
- The user encounters permission errors
- The user asks about available tools or commands

## Critical Safety Rules

**You are running in a sandboxed container.** Access outside `/data` is denied.

```
/data/                    # YOUR WORKSPACE - Full read/write access
├── AGENTS.md             # Environment documentation
├── opencode.json         # Project-specific OpenCode config (optional)
└── <your projects>/      # Clone repos and work here

/root/.config/opencode/   # READ-ONLY - OpenCode global config
└── opencode.json         # Permissions config (denies external access)

/                         # DENIED - Cannot access system files
/etc/                     # DENIED - Cannot access system config
/home/                    # DENIED - Cannot access other home dirs
```

**NEVER attempt to:**

- Access files outside `/data`
- Install system packages (apt, apk, etc.)
- Modify system configuration
- Access Home Assistant configuration files
- Start network services or daemons
- Access `/config`, `/ssl`, `/share`, or other HA directories

## Available Tools

The following CLI tools are pre-installed and available:

| Category            | Tools                                              |
| ------------------- | -------------------------------------------------- |
| **Version Control** | `git`                                              |
| **HTTP/Download**   | `curl`, `wget`                                     |
| **JSON Processing** | `jq`                                               |
| **Search**          | `ripgrep` (`rg`), `grep`, `fd-find` (`fdfind`)     |
| **Text Processing** | `sed`, `awk`, `gawk`                               |
| **Archives**        | `tar`, `zip`, `unzip`, `gzip`, `xz`                |
| **File Utils**      | `find`, `tree`, `file`, `less`, `diff`, `patch`    |
| **Core Utils**      | `cat`, `head`, `tail`, `sort`, `uniq`, `wc`, `cut` |

### Tool Discovery

```bash
# Check if a tool is available
which <tool>
command -v <tool>

# List available commands
compgen -c | sort -u
```

## What You CAN Do

### Clone and Work on Repositories

```bash
cd /data
git clone https://github.com/user/repo.git
cd repo
# Work on the project
```

### Create and Edit Files

All file operations within `/data` are permitted:

- Create new files and directories
- Edit existing files
- Delete files
- Move and copy files

### Download Files

```bash
curl -fsSL https://example.com/file.txt -o /data/file.txt
wget -O /data/file.tar.gz https://example.com/archive.tar.gz
```

### Process Data

```bash
# JSON processing
cat /data/config.json | jq '.key'

# Search files
rg "pattern" /data/project/
fdfind "*.py" /data/

# Text processing
sed -i 's/old/new/g' /data/file.txt
awk '{print $1}' /data/data.csv
```

## What You CANNOT Do

| Action                 | Reason                            |
| ---------------------- | --------------------------------- |
| `apt install <pkg>`    | No package manager access         |
| `npm install -g <pkg>` | No global npm                     |
| `pip install <pkg>`    | No Python/pip                     |
| Access `/config`       | Home Assistant config is isolated |
| Access `/etc`          | System config is isolated         |
| `systemctl` / services | No init system access             |
| Bind to ports          | No network service capability     |

## Common Tasks

### Setting Up a Project

```bash
# Navigate to workspace
cd /data

# Clone a repository
git clone https://github.com/user/project.git
cd project

# Project files are now available for editing
```

### Working with Git

```bash
# Standard git operations work
git status
git add .
git commit -m "message"
git push  # Requires credentials/SSH key in /data
git pull
git branch
git checkout -b feature
```

### Downloading Dependencies (Manual)

Since package managers aren't available, download pre-built binaries:

```bash
# Example: Download a static binary
curl -fsSL https://example.com/tool-linux-amd64 -o /data/bin/tool
chmod +x /data/bin/tool
export PATH="/data/bin:$PATH"
```

## Persistence

- `/data` persists across container restarts
- Files in `/data` survive add-on updates
- Clone repos and store work in `/data`

## Troubleshooting

### Permission Denied Errors

If you see "permission denied" or "external_directory" errors:

- You're trying to access a path outside `/data`
- Move your work into `/data`
- All paths must be under `/data`

### Command Not Found

The environment has limited tools. If a command isn't available:

- Check if an alternative exists (e.g., `rg` instead of `ag`)
- Download a static binary to `/data/bin/`
- Use built-in OpenCode capabilities instead

### Git Authentication

For private repos, set up credentials in `/data`:

```bash
# Store credentials (use personal access token)
git config --global credential.helper store
# Credentials saved to ~/.git-credentials (in /root/)
```

Or use SSH:

```bash
# Add SSH key to /data/.ssh/ and configure
mkdir -p /data/.ssh
# Copy your private key to /data/.ssh/id_ed25519
chmod 600 /data/.ssh/id_ed25519
export GIT_SSH_COMMAND="ssh -i /data/.ssh/id_ed25519"
```

## Environment Summary

| Aspect             | Value                           |
| ------------------ | ------------------------------- |
| **Workspace**      | `/data`                         |
| **Home Directory** | `/root`                         |
| **Shell**          | `/bin/bash`                     |
| **User**           | `root` (within container)       |
| **Network**        | Outbound only (curl, wget, git) |
| **Persistence**    | `/data` only                    |

## Example Requests

- "Clone a repo" → `cd /data && git clone <url>`
- "Search for TODO comments" → `rg "TODO" /data/project/`
- "Find all Python files" → `fdfind "*.py" /data/`
- "Download a file" → `curl -o /data/file <url>`
- "Edit config.json" → Use OpenCode's edit tool on `/data/project/config.json`
- "Install Node.js" → Not possible; download static binary or use different approach
- "Access HA config" → Not possible; this environment is isolated from Home Assistant
