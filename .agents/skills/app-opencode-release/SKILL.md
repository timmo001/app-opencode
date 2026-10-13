---
name: app-opencode-release
description: Version and release the OpenCode Home Assistant app and its prebuilt images. Use when bumping the app version or the OpenCode major it ships, preparing or publishing a GitHub release, or debugging the release workflow or a missing image.
license: Apache-2.0
compatibility: Requires git and the GitHub CLI from the app-opencode repository root.
---

# Releasing app-opencode

The app is image-only: `opencode/config.yaml` sets `image`, so the Supervisor pulls `<image>:<version>` for the `version` in that file instead of building. A user sees an update as soon as `version` changes on `main`, so the image for that version must already exist for amd64 and aarch64.

## Versions

- The app's `version` in `opencode/config.yaml` is the release version, with no `v` prefix. The release workflow fails when it doesn't match the tag.
- OpenCode and the built-in tools in `image/mise.toml` update themselves at runtime, so a new OpenCode 2.x doesn't need a release. OpenCode stays on major `2`; moving to a new major needs `@opencode/client` and `@opencode/plugin` in `package.json` built for it, the `opencode` reference in `opencode.json` moved with them, and the entrypoint and plugin checked against the new source (see `app-opencode-review`).
- Base images and build tools are pinned by digest in the `Dockerfile`, and Renovate bumps them.

## Release

1. Bump `version` in `opencode/config.yaml` and commit it with the changes it releases.
2. Publish a GitHub release whose tag is that version. `.github/workflows/release.yml` checks the version, builds the image for both architectures with the shared `build-container-image.yml`, pushes it to GHCR tagged with the version, major.minor and `latest`, then commits the release notes to `opencode/CHANGELOG.md` with the shared `home-assistant-app-changelog.yml`, which Home Assistant shows in the update dialog.
3. Check the workflow finished and the image's manifest lists both platforms (`docker buildx imagetools inspect ghcr.io/timmo001/app-opencode:<version>`).

The changelog job pushes to `main` with the `RELEASE_COMMIT_TOKEN` secret, since the ruleset blocks `GITHUB_TOKEN`. A missing or expired token only warns.

Releasing is a public, irreversible publish. Commit, push and create the release only when the user asks for each step, and use their chosen version. After the first release, check the GHCR package is public, as the Supervisor pulls it without credentials.

## Prereleases

Prereleases publish nothing, so test a release candidate through CI's image build and smoke test, as `app-opencode-review` describes.
