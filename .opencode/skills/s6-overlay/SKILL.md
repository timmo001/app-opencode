---
name: s6-overlay
description: S6 overlay service management for Home Assistant add-ons including init scripts, service definitions, and lifecycle management
---

# S6 Overlay for Home Assistant Add-ons

This skill covers the S6 overlay init system used in Home Assistant add-ons for service management.

## Directory Structure

```
rootfs/
└── etc/
    ├── cont-init.d/        # Initialization scripts (run once at startup)
    │   ├── 00-banner.sh    # Optional: Show startup banner
    │   └── 01-setup.sh     # Setup scripts (numbered for order)
    └── services.d/         # Long-running services
        └── myservice/
            ├── run         # Service start script (required)
            └── finish      # Cleanup script (optional)
```

## Initialization Scripts (`cont-init.d/`)

Scripts in `cont-init.d/` run once when the container starts, before services.

### Naming Convention

Use numbered prefixes for execution order:

- `00-banner.sh` - First
- `01-config.sh` - Second
- `02-setup.sh` - Third

### Example Init Script

```bash
#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on
# Initialize configuration and directories
# ==============================================================================

readonly CONFIG_DIR="/data/config"

# Create required directories
mkdir -p "${CONFIG_DIR}"

# Check required configuration
if ! bashio::config.has_value 'api_key'; then
    bashio::log.error "API key is required"
    exit 1
fi

# Setup configuration files
bashio::log.info "Initializing configuration..."

# Init scripts should exit 0 on success
exit 0
```

### Exit Codes

- `0` - Success, continue startup
- Non-zero - Failure, container will not start

## Service Scripts (`services.d/`)

### Run Script (Required)

The `run` script starts and maintains the service. It must:

1. Use `exec` to replace the shell with the service process
2. Run in the foreground (not daemonize)

```bash
#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on
# Runs the main service
# ==============================================================================

# Set up environment
export HOME=/root

# Configure from add-on options
if bashio::config.has_value 'password'; then
    export SERVICE_PASSWORD="$(bashio::config 'password')"
fi

bashio::log.info "Starting service..."

# Use exec to replace shell - service runs in foreground
exec myservice --foreground --port 8080
```

### Finish Script (Optional)

The `finish` script runs when the service stops. Use it for cleanup or crash handling.

```bash
#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on
# Handle service shutdown/crash
# ==============================================================================

# $1 = exit code of the run script
# $2 = exit code of the service (if different)

declare exit_code=${1}

# Exit code 0 = normal shutdown
# Exit code 256 = SIGTERM (normal stop)
if [[ "${exit_code}" -eq 0 ]] || [[ "${exit_code}" -eq 256 ]]; then
    bashio::log.info "Service stopped normally"
    exit 0
fi

# Non-zero exit = crash
bashio::log.warning "Service crashed with exit code ${exit_code}"

# Option 1: Let S6 restart the service (default behavior)
# Just exit, S6 will restart based on settings

# Option 2: Halt the entire add-on
/run/s6/basedir/bin/halt
```

## Service Lifecycle

1. Container starts
2. `cont-init.d/` scripts run in order
3. Services in `services.d/` start
4. S6 monitors services and restarts on crash
5. On container stop, services receive SIGTERM
6. `finish` scripts run for cleanup

## Multiple Services

You can run multiple services:

```
rootfs/etc/services.d/
├── main-app/
│   ├── run
│   └── finish
├── worker/
│   └── run
└── nginx/
    └── run
```

Each service runs independently and is monitored by S6.

## Environment Variables

Use `with-contenv` in the shebang to inherit container environment:

```bash
#!/command/with-contenv bashio
```

This gives access to:

- Environment from Dockerfile
- Home Assistant add-on environment
- Variables set by init scripts

## Logging

All stdout/stderr from services is captured by S6 and forwarded to Home Assistant logs.

```bash
bashio::log.info "This appears in HA logs"
echo "This also appears in logs"
```

## Common Patterns

### Wait for dependency

```bash
#!/command/with-contenv bashio
# Wait for database to be ready
while ! pg_isready -h localhost; do
    bashio::log.info "Waiting for database..."
    sleep 2
done
exec myapp
```

### Graceful shutdown

```bash
#!/command/with-contenv bashio
# In run script - handle SIGTERM
trap 'bashio::log.info "Shutting down..."; kill $PID; wait $PID' SIGTERM

myapp &
PID=$!
wait $PID
```

### Conditional service

```bash
#!/command/with-contenv bashio
# Only run if feature enabled
if ! bashio::config.true 'enable_worker'; then
    bashio::log.info "Worker disabled, sleeping forever"
    exec sleep infinity
fi
exec worker-process
```
