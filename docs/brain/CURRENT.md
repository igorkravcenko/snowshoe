---
status: canonical
updated: 2026-09-25
---

# CURRENT

**Implementation status: pre-code / scaffold only.** This repo has no application code.

## Product

- **Working name:** Snowshoe (provisional; not final brand). Short form in chat: *snow*. **Backup:** Catchmark.
- **Subtitle:** Catch up after pull.
- **Wedge:** git-native / ideally OSS layer for a *personal* repo comprehension map. After commits or `git pull`, show what went stale; the human chooses what to catch up on (agency). Structure exists so the human can explore and rank misunderstanding — not only consume an agent “red queue.”
- **Form (intent):** CLI-first **orchestrator** (not a passive ledger, not a full agent harness). Owns git-anchored state, freshness, and verify protocol; pluggable agent backends are workers for map / explain / quiz. Dual entry: harness skills call `snow …`, or snow invokes a configured backend (e.g. catch-up flow). Details: [ADR-2026-09-25-product-form-orchestrator.md](./DECISIONS/ADR-2026-09-25-product-form-orchestrator.md).
- **State default:** project model may live under something like `.snowshoe/`; **personal ledger gitignored / local by default**. [ADR-2026-09-25-personal-state-gitignore.md](./DECISIONS/ADR-2026-09-25-personal-state-gitignore.md).
- **v1 surfaces (intent):** primary signal where “red” arrives on delta — local git hook after pull/merge (+ checkout when relevant) and PR-check; navigable map is a secondary screen for learning, not the only home. CLI always; optional TUI for status/queue/quiz; local GUI map on demand. [ADR-2026-09-25-v1-surfaces.md](./DECISIONS/ADR-2026-09-25-v1-surfaces.md).

## Non-goals (v1)

- Chat hell / “ask the repo” as the product
- AI code review
- Multiplayer knowledge graph as the first wedge
- Agent HITL / control plane
- Nested full agent harness / competing with Cursor-class runtimes
- SaaS dashboard as the product home
- Generic “mental model / knowledge graph / agent memory” category positioning

## Monetization

Locked for now; **not implementing billing.** Ladder, do-nots, and public analog prices: [ADR-2026-09-25-monetization-ladder.md](./DECISIONS/ADR-2026-09-25-monetization-ladder.md).

OSS / local core free forever → paid sync / hosted convenience → team seats only on shared surfaces later. Solo willingness-to-pay test: **$5–20/mo**. Avoid core paywall, AI-review pricing, and enterprise day-1.

No Snowshoe ARR or user counts exist to cite. Do not invent them. There is no proven public price anchor for a “personal catch-up map.”

## Name

[ADR-2026-09-25-provisional-name-snowshoe.md](./DECISIONS/ADR-2026-09-25-provisional-name-snowshoe.md). Rejected naming angles (history, not canon): [notes/naming-history-rejected.md](./notes/naming-history-rejected.md).

## Now

The brain scaffold *is* the repo. Next: grill the v1 signal / PR-check shape and promote open questions before writing code. Positioning: [docs/product/positioning.md](../product/positioning.md). Working notes on form detail: [notes/product-form-detail.md](./notes/product-form-detail.md).

## Process / quality

- Docs land via PR. Chief of Staff owns **consistency audit** before merge (auditor / `grill-canon`).
- Docs-only CI tripwire: `brain-docs` lint — [ADR-2026-09-25-brain-docs-ci.md](./DECISIONS/ADR-2026-09-25-brain-docs-ci.md).
