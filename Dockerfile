# The OpenCode app for Home Assistant. The Supervisor pulls this image, prebuilt for amd64 and
# aarch64 by the release workflow, and runs it as root, which it needs for /data and apt.
#
# Debian gives the system packages and mise everything else. The tools in image/mise.toml are
# installed here, into mise's system folders, and updated at runtime into $HOME, which is kept
# in /data, so OpenCode and its tools stay current without an app release.

FROM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS build

WORKDIR /src

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src src
COPY scripts scripts
COPY opencode/config.yaml opencode/config.yaml

RUN bun run build

FROM jdxcode/mise:2026.10.13@sha256:a2f1563d47f56a7ce69d5c94ac61d9f7af5063613bfd3c50e6268768ed9c87ad AS mise

FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS app

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# The packages OpenCode and the agent expect on any machine. The app installs more from its
# system_packages option on start, so these are kept to what most work needs.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash-completion \
        ca-certificates \
        curl \
        git \
        less \
        libatomic1 \
        openssh-client \
        procps \
        unzip \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=mise /usr/local/bin/mise /usr/local/bin/mise
COPY image/mise.toml /etc/mise/config.toml
COPY image/profile.sh /etc/profile.d/mise.sh
COPY image/bashrc /etc/bash.bashrc
COPY image/inputrc /etc/opencode-app/inputrc
COPY image/gitconfig /etc/gitconfig
COPY image/lazygit.yml /etc/xdg/lazygit/config.yml
# OpenCode's system config folder. It holds the app's skills, and the app links ha-bridge's and
# triage's in.
COPY image/skills /etc/opencode/skills

# Node and aube first, since the npm tools install with them. Caches go with the layer.
RUN HOME=/root mise install --system node aqua:aubepkg/aube \
    && HOME=/root mise install --system \
    && rm -rf /root/.cache /root/.local

# The tools option's default list, so a new install starts without downloading it. They're only
# active while they're in the option; the app removes any you take off it. uv's Python goes in
# the image too, since the pypi tools' environments point at it.
COPY --from=build /src/dist/default-tools.txt /usr/local/share/opencode-app/default-tools.txt
RUN HOME=/root UV_PYTHON_INSTALL_DIR=/usr/local/share/uv/python \
        xargs mise install --system < /usr/local/share/opencode-app/default-tools.txt \
    && HOME=/root mise reshim --system \
    && rm -rf /root/.cache /root/.local

COPY --from=build /src/dist/opencode-app /usr/local/bin/opencode-app
COPY --from=build /src/dist/plugin.js /usr/local/share/opencode-app/plugin.js
COPY --from=build /src/dist/web /usr/local/share/opencode-app/web

ENV HOME=/data/home \
    EDITOR=nvim \
    HA_BRIDGE_SOCK=/run/ha-bridge.sock \
    LANG=C.UTF-8 \
    MISE_YES=1 \
    OPENCODE_DISABLE_AUTOUPDATE=1 \
    PATH=/data/home/.local/share/mise/shims:/usr/local/share/mise/shims:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WORKDIR /data/home

EXPOSE 8099 49374

ENTRYPOINT ["/usr/local/bin/opencode-app"]
