---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: Product form = orchestrator (not harness, not passive CLI)

## Status

Accepted.

## Context

Nearly every Snowshoe scenario (build/update mental map, explain, quiz, assist knowledge status) needs an agent. A purely passive ledger cannot deliver the vision. Becoming a full agent harness (nested loops, competing with Cursor/Claude Code) fights the platform-agnostic “orca” posture and inflates scope. Skills alone cannot reliably teach arbitrary agents a stable verify protocol.

## Decision

Snowshoe is a **product orchestrator / overlay**:

| Snowshoe owns | Pluggable agent backend does |
|---|---|
| State, git anchors, freshness, verify protocol | Draft / update map slices |
| When to call an agent, brief, done criteria | Explain a node; run quiz per Snowshoe schema |
| CLI, hooks, map UI, ledger writes | Text drafts; accepted only through contract |

**Dual entry (both valid):**

1. User already in a harness → skill teaches calling `snowshoe …` (provisional binary-shaped example; binary name TBD) and respecting verify.
2. No harness / hook / orchestrated catch-up flow → Snowshoe invokes a configured worker backend for that step (“call a worker,” not “inherit the harness event loop”). Subcommand names are not locked.

Do **not** attempt to “inherit” an arbitrary harness runtime via skill invocation as a general API — formats and permissions differ per tool.

Informal chat shorthand *snow* is **not** a naming decision (not CLI, not locked short form).

## Alternatives considered

- Passive CLI only — rejected; vision requires agents in most flows.
- Full nested harness inside Snowshoe — rejected; scope and platform competition.
- Skills-only protocol with no owned state machine — rejected; unstable green/verify.

## Consequences

- CURRENT describes orchestrator form.
- Implementation stays pre-code until surfaces are grilled; when code starts, agent backends are adapters, not the product identity.
- Skills are entry documentation + command recipes, not the source of truth for state.

## See also

Hooks remain a Snowshoe-owned surface, but they are **opt-in** (`hooks install` / `uninstall`); `init` does not install them. Default signal is skill → CLI. Map UI is later (`snowshoe map` local HTTP), not day-1. [ADR-2026-09-25-implementation-stack.md](./ADR-2026-09-25-implementation-stack.md), [ADR-2026-09-25-v1-surfaces.md](./ADR-2026-09-25-v1-surfaces.md). Informal *snow* is not CLI.

## Evidence

`cognitive-model-erosion/07-product-form.md` (discussion artifact). Skills overlap brief: teach-back skills exist; none own git-delta personal freshness (see `docs/evidence/`).
