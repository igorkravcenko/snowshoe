---
status: note
date: 2026-09-27
---

# How to try the E2E

Manual try of [e2e-happy-path-no-learning.md](./e2e-happy-path-no-learning.md). Put **`snowshoe` on PATH** (see `.cursor/skills/snowshoe/install.md`: `bun link` / `npm link` from the package root). Then, in the repo you are mapping:

1. `snowshoe init --json --locale ru` (or `en`; or start with `snowshoe work next --json` and follow `todo`, adding `--locale` on init)
2. Load skill `.cursor/skills/snowshoe/`. Ask it to drain Snowshoe work.
3. Agent starts at `snowshoe work next --json` → follows `todo` / `items` → `work complete` (detail upserts include a `body` in that locale).
4. `snowshoe map serve --open` → walk the tree (gray = unexpanded / low float). Inspector shows entity body markdown.
5. Mark detail on a child → pending badge → agent drains again → **Reload**.
6. Click an anchor (any node, including non-leaf modules) → in-UI Code preview. `vscode://` is secondary “Open in editor”. Optional: pull/commit; agent `work next` will ask for `routine refresh`, then drain, then `routine advance` when idle → Reload.

Do not commit `.snowshoe/`. The human marks, cancels, and reloads the map; the agent completes through the CLI.
