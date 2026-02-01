# AGENTS.md - OpenCode Home Assistant Add-on

Guidelines for AI coding agents working in this repository.

## Project Overview

A **Home Assistant add-on** packaging OpenCode into a Docker container. Primary files:

- Shell scripts (bash with bashio library)
- YAML configuration files
- Dockerfile for container builds

**No TypeScript/JavaScript** - this is a deployment/packaging project.

## Build/Lint/Test Commands

```bash
npm run format        # Format all files with Prettier
npm run format:check  # Check formatting only
yamllint opencode/    # YAML linting (if installed)
mdl *.md opencode/*.md # Markdown linting (if installed)

# Build Docker image locally (from opencode/ directory)
docker build --build-arg BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.2.0 \
             --build-arg BUILD_ARCH=amd64 -t opencode-local .
```

## Code Style Guidelines

### File Naming

| Type          | Convention             | Example                     |
| ------------- | ---------------------- | --------------------------- |
| Config files  | lowercase with hyphens | `build.yaml`, `config.yaml` |
| Shell scripts | lowercase              | `repositories.sh`, `run`    |
| Documentation | UPPERCASE.md           | `DOCS.md`, `README.md`      |

### Shell Scripts

Use the `shell-scripts` skill for detailed patterns. Quick reference:

```bash
#!/command/with-contenv bashio
readonly REPOS_DIR="/data/repos"     # Constants: SCREAMING_SNAKE_CASE + readonly
repo_path="${REPOS_DIR}/${repo_name}" # Local vars: lowercase_underscores
bashio::log.info "Message"            # Logging via bashio
value=$(bashio::config 'key')         # Config access via bashio
```

Always quote variables: `"${variable}"`

### YAML Files

- Must begin with `---`
- 2 spaces indentation (no tabs)
- Max line length: 120 characters
- Multi-line strings: use `>-` folded style

```yaml
---
name: OpenCode
description: >-
  Multi-line description folded into single line.
```

### Dockerfile

Use the `dockerfile` skill for detailed patterns. Quick reference:

```dockerfile
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Architecture handling - use explicit case statements
case "${BUILD_ARCH}" in
    aarch64) ARCH="arm64" ;;
    amd64) ARCH="amd64" ;;
    *) echo "Unsupported architecture" && exit 1 ;;
esac

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
```

### Prettier Configuration

Settings: semicolons required, single quotes, 2-space tabs, ES5 trailing commas, 100 char width.

## Architecture

```
opencode/
├── build.yaml              # Build configuration
├── config.yaml             # Add-on configuration schema
├── DOCS.md                 # User documentation
├── Dockerfile              # Container build
├── translations/en.yaml    # Localization
└── rootfs/                 # Container filesystem overlay
    ├── etc/cont-init.d/    # S6 initialization scripts
    ├── etc/services.d/     # S6 service definitions (run + finish)
    └── root/.config/       # Default configurations
```

## Key Conventions

### Data Persistence

All persistent data in `/data/`:

- `/data/repos/` - Cloned repositories
- `/data/.config/gh/` - GitHub CLI config
- `/data/.gitconfig` - Git configuration
- `/data/.ssh/` - SSH keys

### S6 Overlay

Use the `s6-overlay` skill for detailed patterns. Quick reference:

- Init scripts: `rootfs/etc/cont-init.d/` (run once at startup, numbered for order)
- Service scripts: `rootfs/etc/services.d/<service>/` (must have `run`, optionally `finish`)

### Supported Architectures

Both must be supported: `amd64` (x86_64) and `aarch64` (ARM64)

## Available Skills

Load these skills for detailed implementation guidance:

| Skill           | Use When                                                           |
| --------------- | ------------------------------------------------------------------ |
| `shell-scripts` | Writing bash scripts with bashio (logging, config, error handling) |
| `dockerfile`    | Writing Dockerfiles (multi-arch, hadolint, build args)             |
| `s6-overlay`    | S6 service management (init scripts, run/finish, lifecycle)        |

## Important Notes

1. **Security**: Sandbox mode - external directory access denied by default
2. **Workspace**: Restricted to `/data`
3. **No Tests**: No automated test suite
4. **Build System**: Handled by Home Assistant's add-on build infrastructure
