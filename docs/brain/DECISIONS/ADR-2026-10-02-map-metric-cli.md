---
status: accepted
date: 2026-10-02
---

# ADR-2026-10-02: CLI map metric set

## Status

Accepted. Amends [ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) and display claims in [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md). Does **not** ship learning/quiz/verify as a protocol. Does **not** promote routine ADRs A/B.

## Context

Metric floats live in SQLite (`overview` / `contracts` / `internals`, `0.0–1.0`). Agents lower them via routine `metric_decay`. Operators needed a direct CLI to raise or set personal comprehension without waiting for a learning queue that is still out of scope.

## Decision

1. **`snowshoe map metric --json --slug <slug>`** with one or more of `--overview` / `--contracts` / `--internals` (each a float in `[0, 1]`). Unknown slug or no levels → usage reject.
2. **Allows raise and lower.** This is an operator write, not a `work next` hop and not gated by blast severity caps.
3. **Parent honesty on drop:** if a set value is below the stored previous (or previous was null, still apply min-decay when parents have a higher stored value and child is lower), ancestors may be min-decayed on that level — never auto-raised.
4. **HTTP twin:** `POST /api/map/metric` with JSON `{ slug, overview?, contracts?, internals? }` shares `runMapMetric`.
5. **Not** a substitute for learning/quiz/verify; skill may run it only when the human asked this turn to set understanding.

## Alternatives considered

- Only allow raise via a future learn command — rejected; operators need a write now for dogfood.
- Force all metric writes through `metric_decay` — rejected; that path is routine-only and cannot raise.
- UI-only editor — deferred; CLI-first orchestrator.

## Consequences

CURRENT lists `map metric`. Agents see it in `snowshoe help --json`. Map UI may call the HTTP twin later; not required in this change.

## Evidence

None beyond this change’s tests.
