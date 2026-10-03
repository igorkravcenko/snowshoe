---
status: accepted
date: 2026-09-26
---

# ADR-2026-09-26: Vertical-slice CLI (HP1–4, no learning)

## Status

Accepted. Authorizes the first application code. Does **not** promote proposed routine ADRs A/B to CURRENT.

## Context

CURRENT and the stack ADR described a pre-code scaffold. Happy-path notes (HP1–4), the skill-worker contract, detail-queue, and map read-model schemas specify a no-learning vertical slice. CoS / product owner day-1 locks (root slug `root`, `map status` / `map detail mark|cancel`, one work bus, routine-first, no hooks on `init`) asked for working Bun/TypeScript CLI + tests without rewriting proposed ADR-A/B bodies.

## Decision

Ship a **CLI-only** Snowshoe util that implements HP1–4:

- Binary spelling: provisional `snowshoe`.
- Stack as locked: TypeScript, Bun, citty, Zod, `bun:sqlite`, tests via `bun test` (see Consequences for Vitest).
- Follow proposed [ADR-2026-09-25-routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md) and [ADR-2026-09-25-routine-cli-and-fsm](./ADR-2026-09-25-routine-cli-and-fsm.md) **as-is** for routine epochs/work; they remain **proposed**.
- Detail lives on the same work bus (`kind=detail`); it never gates `base` / `routine advance`. Agent-facing detail complete uses **`children`** (parent→child) and **`refs`** (relevance), not a single `edges` list; missing/moved anchors **reject** ([ADR-2026-09-27-detail-children-refs](./ADR-2026-09-27-detail-children-refs.md)).
- `init` does not install hooks and does not spawn agents.
- `.snowshoe/**` is local / gitignored. SQLite is SoT.

This ADR does not add learning, quiz, verify, map HTTP UI, Nest/Next/Electron, or hook install.

## Alternatives considered

- Wait until A/B are promoted — rejected; slice is explicitly allowed to follow proposed A/B as working code.
- Rewrite A/B bodies to include `detail` — rejected; carve-outs stay in notes until promote.
- Vitest as the only runner in this slice — see Consequences.

## Consequences

- CURRENT implementation status is no longer “pre-code / scaffold only.”
- A/B stay proposed; do not treat this CLI as proof they are accepted.
- Test runner in this slice is **`bun test`** (`bun:test`) so the documented acceptance command works. Stack ADR still prefers Vitest; switching the runner does not need to block this slice.
- Routine completeness is a **minimal honest subset** of ADR-B (structure / blast / metric_decay accept gates enough for HP3–4). Parent min-decay is a simple deterministic min; ignore-globs stay empty.

## Evidence

- [../notes/happy-paths.md](../notes/happy-paths.md)
- [../notes/skill-worker-contract.md](../notes/skill-worker-contract.md)
- [../notes/detail-queue-and-map.md](../notes/detail-queue-and-map.md)
- [../notes/ui-ledger-split.md](../notes/ui-ledger-split.md)
- [../notes/gaps-vs-adr-b-work-bus.md](../notes/gaps-vs-adr-b-work-bus.md)
