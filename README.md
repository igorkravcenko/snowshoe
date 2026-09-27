# Snowshoe

**Catch up after pull.**

A git-native, ideally OSS layer for a *personal* repo comprehension map. After commits or `git pull`, show what went stale; the human chooses what to catch up on.

Working name is **Snowshoe** (not final). Backup: **Catchmark**.

This repository now includes a **CLI vertical slice** (HP1–4, no learning). The spec-driven “brain” (product truth, decisions, agent protocol) remains the source of claims. Routine epoch ADRs are still **proposed**.

```bash
bun install
bun src/index.ts init --json
bun test
```

`.snowshoe/` is personal/local and gitignored. `init` does not install git hooks.

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
