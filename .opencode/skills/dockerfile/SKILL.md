---
name: dockerfile
description: Writing Dockerfiles for Home Assistant add-ons with multi-arch support, hadolint compliance, and proper build argument handling
---

# Dockerfile for Home Assistant Add-ons

This skill covers writing Dockerfiles for Home Assistant add-on containers.

## Base Structure

```dockerfile
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell with pipefail for proper error handling
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install requirements
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        package1 \
        package2 \
    && rm -rf /var/lib/apt/lists/*

# Copy root filesystem overlay
COPY rootfs /

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_REF
ARG BUILD_VERSION

# Labels (OCI standard)
LABEL \
    io.hass.name="Add-on Name" \
    io.hass.description="Description" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    org.opencontainers.image.title="Add-on Name" \
    org.opencontainers.image.description="Description" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
```

## Multi-Architecture Support

Always handle both `amd64` and `aarch64` architectures:

```bash
# Architecture mapping for downloads
case "${BUILD_ARCH}" in
    aarch64) ARCH="arm64" ;;
    amd64) ARCH="amd64" ;;
    *) echo "Unsupported architecture: ${BUILD_ARCH}" && exit 1 ;;
esac
```

### Example: Downloading Architecture-Specific Binaries

```dockerfile
ARG BUILD_ARCH
ARG TOOL_VERSION="1.0.0"

RUN \
    case "${BUILD_ARCH}" in \
        aarch64) ARCH="arm64" ;; \
        amd64) ARCH="amd64" ;; \
        *) echo "Unsupported architecture" && exit 1 ;; \
    esac \
    && curl -fsSL "https://example.com/tool-${TOOL_VERSION}-linux-${ARCH}.tar.gz" \
        | tar -xz -C /usr/local/bin
```

## Hadolint Compliance

### Common Ignores

```dockerfile
# Ignore dynamic FROM (required for HA add-ons)
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Ignore pinning versions (when using base image packages)
# hadolint ignore=DL3008
RUN apt-get install -y package

# Ignore curl/wget piping (when necessary)
# hadolint ignore=DL4006
RUN curl -fsSL https://example.com/script.sh | bash
```

### Best Practices

```dockerfile
# Always clean up apt cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        package \
    && rm -rf /var/lib/apt/lists/*

# Pin versions when possible
RUN apt-get install -y --no-install-recommends \
    git=1:2.39.2-1

# Use --no-install-recommends to reduce image size
RUN apt-get install -y --no-install-recommends package
```

## Build Arguments

Standard Home Assistant add-on build arguments:

| Argument        | Description                  |
| --------------- | ---------------------------- |
| `BUILD_FROM`    | Base image (from build.yaml) |
| `BUILD_ARCH`    | Target architecture          |
| `BUILD_DATE`    | Build timestamp              |
| `BUILD_REF`     | Git commit reference         |
| `BUILD_VERSION` | Add-on version               |

Custom build arguments are defined in `build.yaml`:

```yaml
# build.yaml
args:
  TOOL_VERSION: '1.0.0'
```

## Shell Configuration

Always set shell with pipefail:

```dockerfile
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
```

This ensures that pipeline failures are caught (e.g., `curl | tar` fails if curl fails).

## Copy Patterns

```dockerfile
# Copy entire rootfs overlay
COPY rootfs /

# Copy specific files
COPY --chmod=755 scripts/run.sh /usr/local/bin/

# Copy with ownership
COPY --chown=root:root config /etc/app/
```

## Environment Variables

```dockerfile
# Set environment for runtime
ENV HOME=/root \
    LANG=C.UTF-8

# Don't store secrets in ENV - use runtime configuration
```

## Workdir and User

```dockerfile
# Set working directory
WORKDIR /data

# Run as non-root when possible (but HA add-ons often need root)
USER root
```

## Labels

Use both Home Assistant and OCI standard labels:

```dockerfile
LABEL \
    io.hass.name="OpenCode" \
    io.hass.description="AI coding assistant" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Your Name <email@example.com>" \
    org.opencontainers.image.title="OpenCode" \
    org.opencontainers.image.description="AI coding assistant" \
    org.opencontainers.image.source="https://github.com/user/repo" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
```
