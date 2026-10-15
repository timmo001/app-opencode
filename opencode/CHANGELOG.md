Backups are much smaller. They now leave out what can be rebuilt: caches, everything mise installs, projects' node_modules and .venv folders, package manager caches and stores, and OpenCode's undo snapshots and reference checkouts. After a restore, the tools option installs again on the next start; run mise install for tools you added with mise use or a project's mise.toml.

Effect is updated to v4.0.5 and uv to v0.13.1.
