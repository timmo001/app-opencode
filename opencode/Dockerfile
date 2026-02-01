ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.2.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install requirements for app
ARG BUILD_ARCH=amd64

# Install dependencies and common tools for OpenCode
RUN \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
        git \
        openssh-client \
        jq \
        ripgrep \
        fd-find \
        sed \
        gawk \
        grep \
        coreutils \
        findutils \
        diffutils \
        patch \
        file \
        tree \
        unzip \
        zip \
        tar \
        gzip \
        xz-utils \
        less \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
ARG GH_VERSION="2.65.0"
RUN \
    case "${BUILD_ARCH}" in \
        "amd64") GH_ARCH="linux_amd64" ;; \
        "aarch64") GH_ARCH="linux_arm64" ;; \
        *) echo "Unsupported architecture for gh: ${BUILD_ARCH}" && exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_${GH_ARCH}.tar.gz" \
        | tar -xz --strip-components=1 -C /usr/local \
    && gh --version

# Install OpenCode binary from GitHub releases
ARG OPENCODE_VERSION="1.1.48"
RUN \
    case "${BUILD_ARCH}" in \
        "amd64") OPENCODE_ARCH="linux-x64" ;; \
        "aarch64") OPENCODE_ARCH="linux-arm64" ;; \
        *) echo "Unsupported architecture for OpenCode: ${BUILD_ARCH}" && exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-${OPENCODE_ARCH}.tar.gz" \
        | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/opencode \
    && opencode --version

# Copy root file system
COPY rootfs /

# Set up persistent symlinks for git/ssh/gh config
RUN \
    mkdir -p /data/.ssh /data/.config/gh /data/repos \
    && chmod 700 /data/.ssh \
    && mkdir -p /root/.config \
    && rm -rf /root/.ssh /root/.config/gh /root/.gitconfig \
    && ln -s /data/.ssh /root/.ssh \
    && ln -s /data/.config/gh /root/.config/gh \
    && ln -s /data/.gitconfig /root/.gitconfig

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Dale Higgs <@dale3h>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="Home Assistant Community Apps" \
    org.opencontainers.image.authors="Dale Higgs <@dale3h>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://apps.community" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
