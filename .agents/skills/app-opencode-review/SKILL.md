---
name: app-opencode-review
description: Review, clean up and test a changeset in the OpenCode Home Assistant app, whether a pull request, a branch, recent commits or uncommitted changes. Use when asked to review changes, check whether review comments are valid, or test the app image for real before it ships.
license: Apache-2.0
compatibility: Requires git and Docker with BuildKit from the app-opencode repository root. Pull request steps also need gh; testing inside Home Assistant needs a Home Assistant OS or Supervised instance the user names.
---

# app-opencode review

Work through these steps in order, skipping those that don't apply. Never merge, comment on or resolve review threads without the user's say so for that change.

## 1. Find the changeset

The changeset is the scope: review and change only what it introduces or makes worse.

- A pull request or branch: `git fetch origin`, check it out, and diff with `git diff origin/main...HEAD`. Find a PR's number with `gh pr list --head <branch>`.
- Recent commits: the range the user names.
- Uncommitted work: `git diff`, `git diff --staged` and new files from `git status`.

Then load every skill that matches the changed files: `app-opencode-dockerfile` for the `Dockerfile` and `image/mise.toml`, `effect` and `effect-service-design` for `src/`, `app-opencode-release` for versions and release workflows, plus the shared language, writing and testing skills.

## 2. Check claims against the source

Changes here describe how the Supervisor and OpenCode behave. Check each claim in the referenced source before trusting it, not from memory:

- `config.yaml` options, roles, `map`, ingress and backups: the `supervisor` and `dev-docs` references.
- OpenCode serve, service mode, `service.json`, pairing, server auth, plugins and paths: the `opencode` reference, which is pinned to the release the client and plugin are built against. If `@opencode/client` or `@opencode/plugin` changed in `package.json`, check the reference moved with them.
- mise behaviour (system and user layers, `install`, `outdated`, shims): the mise docs, or try it locally with `MISE_SYSTEM_CONFIG_DIR` pointed at a copy of `image/mise.toml`.
- OpenTunnel identity and certificate storage: the `opentunnel` reference.

Anything the app keeps between restarts must live under `/data`, and anything the user edits under the `addon_config` mount. Check a new path against both.

## 3. Clean up

Fix only what the changeset introduces: unpinned images, options added to `config.yaml` without a matching field in `src/Options.ts`, a translation in `opencode/translations/en.yaml` or a line in `DOCS.md`, built-in tools missing from DOCS' preinstalled list, option values reaching a shell, secrets logged or exported further than needed, comments heavier than the code around them, and anything against `AGENTS.md`. Run `mise run check` and `mise run build`, then `dot agent oxlint --changed`, all with no warnings.

## 4. Validate review comments

Read every source on a pull request: review bodies (`gh api repos/timmo001/app-opencode/pulls/<n>/reviews`), inline comments (`.../pulls/<n>/comments`) and PR comments (`.../issues/<n>/comments`). For each finding, trace it in the current code, say whether it's valid and why, and give the smallest fix. Fix only when asked.

## 5. Test for real

Linting doesn't show the app starts. CI's smoke test runs the image the way the Supervisor does: as root, with a throwaway `/data` holding a root-owned `options.json` and `/config` mounted, and checks OpenCode starts, pairing answers, the options install and the `tools` option survives a restart. Read its logs on the pull request. Where Docker is available locally, the same build is:

```bash
docker buildx build --platform linux/amd64 -t app-opencode:test .
```

Without Docker, the entrypoint can run on the host against temporary folders under `/tmp/opencode`, with `OPENCODE_APP_DATA`, `OPENCODE_APP_CONFIG`, `HOME` and `OPENCODE_APP_CONTROL_SOCKET` pointed there. Never point it at the host's own home or mise folders.

Test inside Home Assistant only on an instance the user names, never their production instance without asking. Report what was exercised, what couldn't be tested and why.

## 6. Finish

For a pull request, report CI state with `gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup` and wait. Merge only when the user says so, with `gh pr merge <n> --squash --delete-branch`.
