# Snowshoe

**Catch up after pull.**

A git-native, ideally OSS layer for a *personal* repo comprehension map. After commits or `git pull`, show what went stale; the human chooses what to catch up on.

Working name is **Snowshoe** (not final). Backup: **Catchmark**.

This repository includes a **CLI vertical slice** (HP1–4) plus a **tryable local map UI** and drain skill. The spec-driven “brain” remains the source of claims. Routine epoch ADRs are still **proposed**.

```bash
bun install --frozen-lockfile
bun link                  # puts `snowshoe` on PATH (see .cursor/skills/snowshoe/install.md)
snowshoe init --json --locale ru
bun test
bun run typecheck
bun run check
```

`.snowshoe/` is personal/local and gitignored. `init` does not install git hooks. Install binary is **`snowshoe`** (not `snow`).

## How to try (E2E)

1. `bun install --frozen-lockfile` then put `snowshoe` on PATH (`bun link`).
2. `snowshoe init --json --locale ru` (or `en`; or `snowshoe work next --json` and follow `todo`).
3. Load `.cursor/skills/snowshoe/` and ask the agent to drain Snowshoe work.
4. Agent: `snowshoe work next --json` then `work complete` (detail payload uses `children` + `refs` + `body` in that locale).
5. `snowshoe map serve --open` — walk the tree; inspector shows entity body.
6. Mark a child → pending badge → agent drains → click **Reload**.
7. Click an anchor for in-UI Code preview (`vscode://` is secondary). Optional: commit/pull; `work next` gates refresh then advance.

Longer pointer: [docs/brain/notes/how-to-try-e2e.md](docs/brain/notes/how-to-try-e2e.md).

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| Signal after pull (CLI default; hooks opt-in, not `init`) | Chat hell / "ask the repo" as the product |
| PR-check | AI code review |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

## Docs / brain

Agents start at [AGENTS.md](AGENTS.md), then [docs/brain/START_HERE.md](docs/brain/START_HERE.md).

**Truth** is `docs/brain/CURRENT.md` plus accepted ADRs. Experiments and evidence are not truth. See [docs/README.md](docs/README.md).

## Monetization (not implementing billing)

OSS / local core free forever → paid sync / hosted convenience → team seats only on shared surfaces later. Details in [docs/brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md](docs/brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md).
