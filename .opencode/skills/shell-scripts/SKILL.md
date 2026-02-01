---
name: shell-scripts
description: Writing bash scripts with bashio library for Home Assistant add-ons including logging, config access, error handling, and variable conventions
---

# Shell Scripts for Home Assistant Add-ons

This skill covers writing bash scripts using the bashio library for Home Assistant add-on development.

## Header Format

All scripts must include this header:

```bash
#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant OpenCode App
# Brief description of what this script does
# ==============================================================================
```

## Variable Naming

```bash
# Constants: SCREAMING_SNAKE_CASE with readonly
readonly REPOS_DIR="/data/repos"
readonly GH_CONFIG_DIR="/data/.config/gh"
readonly GITCONFIG="/data/.gitconfig"

# Local variables: lowercase with underscores
repo_count=$(bashio::config 'repositories | length')
repo_name=$(basename "${repo}")
repo_path="${REPOS_DIR}/${repo_name}"
```

## Quoting Rules

Always use `"${variable}"` syntax with double quotes:

```bash
# Correct
mkdir -p "${REPOS_DIR}"
git clone "https://github.com/${repo}.git" "${repo_path}"
cd "${repo_path}"

# Wrong - never do this
mkdir -p $REPOS_DIR
git clone https://github.com/$repo.git $repo_path
```

## Logging with bashio

Use bashio logging functions for all output:

```bash
bashio::log.trace "Detailed debug info"      # Most verbose
bashio::log.debug "Debug information"
bashio::log.info "Normal operation info"     # Default level
bashio::log.notice "Important notice"
bashio::log.warning "Non-fatal warning"
bashio::log.error "Error message"
bashio::log.fatal "Fatal error"              # Most severe
```

## Configuration Access

Access add-on configuration via bashio:

```bash
# Get a config value
value=$(bashio::config 'key')

# Check if config key has a value
if bashio::config.has_value 'key'; then
    # Key exists and has a value
fi

# Get array length (using jq syntax)
count=$(bashio::config 'array_key | length')

# Iterate through array
for i in $(seq 0 $((count - 1))); do
    item=$(bashio::config "array_key[${i}]")
done

# Check boolean config
if bashio::config.true 'enable_feature'; then
    # Feature is enabled
fi
```

## Error Handling Patterns

### Non-fatal Errors

Use `||` fallback for operations that can fail without stopping the script:

```bash
git pull --ff-only || bashio::log.warning "Failed to pull latest changes"
curl -sf "${url}" || bashio::log.warning "Request failed, continuing..."
```

### Fatal Errors

Check exit codes for critical operations:

```bash
if [[ "${1}" -ne 0 ]]; then
    bashio::log.error "Operation failed with exit code ${1}"
    exit 1
fi

# Or use set -e for automatic exit on error
set -e
```

### Service Finish Scripts

Handle service crashes in `finish` scripts:

```bash
#!/command/with-contenv bashio
# Exit code 0 = normal shutdown, non-zero = crash
if [[ "${1}" -ne 0 ]] && [[ "${1}" -ne 256 ]]; then
    bashio::log.warning "Service crashed with code ${1}, halting"
    /run/s6/basedir/bin/halt
fi
```

## Conditional Checks

```bash
# File existence
if [[ -f "${filepath}" ]]; then
    # File exists
fi

if [[ ! -f "${filepath}" ]]; then
    # File does not exist
fi

# Directory existence
if [[ -d "${dirpath}" ]]; then
    # Directory exists
fi

# String comparison
if [[ "${var}" == "value" ]]; then
    # Strings match
fi

# Numeric comparison
if [[ "${count}" -gt 0 ]]; then
    # Count is greater than 0
fi
```

## Environment Variables

Export variables for child processes:

```bash
export HOME=/root
export OPENCODE_SERVER_PASSWORD="$(bashio::config 'server_password')"
```

## Common Patterns

### Create directories safely

```bash
mkdir -p "${REPOS_DIR}" "${CONFIG_DIR}"
```

### Symlink for persistence

```bash
if [[ -f "${PERSISTENT_FILE}" ]]; then
    ln -sf "${PERSISTENT_FILE}" "${CONTAINER_PATH}"
fi
```

### Loop through config array

```bash
if bashio::config.has_value 'repositories'; then
    repo_count=$(bashio::config 'repositories | length')
    for i in $(seq 0 $((repo_count - 1))); do
        repo=$(bashio::config "repositories[${i}]")
        bashio::log.info "Processing ${repo}..."
    done
fi
```
