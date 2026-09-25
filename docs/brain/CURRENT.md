---
status: canonical
updated: 2026-09-25
---

# CURRENT

**Implementation status: pre-code / scaffold only.** This repo has no application code.

## Product

- **Working name:** Snowshoe (provisional; not final brand). **Backup:** Catchmark.
- **Subtitle:** Catch up after pull.
- **Wedge:** git-native / ideally OSS layer for a *personal* repo comprehension map. After commits or `git pull`, show what went stale; the human chooses what to catch up on.
- **v1 surfaces (intent):** signal after pull + PR-check.

## Non-goals (v1)

- Chat hell / "ask the repo" as the product
- AI code review
- Multiplayer knowledge graph
- Agent HITL / control plane

## Monetization

Locked for now; **not implementing billing.** Ladder, do-nots, and public analog prices: [ADR-2026-09-25-monetization-ladder.md](./DECISIONS/ADR-2026-09-25-monetization-ladder.md).

OSS / local core free forever → paid sync / hosted convenience → team seats only on shared surfaces later. Solo willingness-to-pay test: **$5–20/mo**. Avoid core paywall, AI-review pricing, and enterprise day-1.

No Snowshoe ARR or user counts exist to cite. Do not invent them. There is no proven public price anchor for a "personal catch-up map."

## Name

[ADR-2026-09-25-provisional-name-snowshoe.md](./DECISIONS/ADR-2026-09-25-provisional-name-snowshoe.md).

## Now

The brain scaffold *is* the repo. Next: grill the v1 signal / PR-check shape before writing code. Positioning: [docs/product/positioning.md](../product/positioning.md).
