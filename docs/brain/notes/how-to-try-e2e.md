---
status: note
date: 2026-09-27
---

# How to try the E2E (no learning)

Manual try of [e2e-happy-path-no-learning.md](./e2e-happy-path-no-learning.md). From the Snowshoe checkout:

1. `bun install`
2. `bun src/index.ts init --json`
3. Load skill `.cursor/skills/snowshoe/` (Cursor: agent with that skill). Ask it to drain Snowshoe work.
4. Agent: `work next` → root `detail` → `work complete` (no `type: system`).
5. `bun src/index.ts map serve --open` → walk the tree (gray = unexpanded / low float).
6. Mark detail on a child → pending badge → agent drains again → **Reload**.
7. Open a leaf via `anchors[]` (editor link). Optional: pull/commit, agent `routine status` → `refresh` → drain → `advance` → Reload.

Do not commit `.snowshoe/`. UI never writes the ledger. Skill never calls `work fail` on detail.
