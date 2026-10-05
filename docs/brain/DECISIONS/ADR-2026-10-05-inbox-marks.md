---
status: accepted
date: 2026-10-05
---

# ADR-2026-10-05: System inbox marks (`new` / `decayed`)

## Status

Accepted. Amends [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md) and [ADR-2026-10-02-map-nav-tabs](./ADR-2026-10-02-map-nav-tabs.md). Does **not** ship learning/quiz/verify. Does **not** make inbox marks `work next` hops.

## Context

After drain, agents create nodes and routine `metric_decay` lowers comprehension. Humans need a lightweight “what changed” surface without a mutation feed. Personal `learn` / `quiz` todos already exist; mixing auto notices into that list without structure would blur intent.

## Decision

1. **Mark kinds** `new` and `decayed` are first-class `node_marks` kinds (not tags, not work hops). They may render beside other marks in the UI.
2. **System stamps only:**
   - `new` — on first insert of a node (`upsertNode` create path), including cold start / init seed.
   - `decayed` — when a stored metric is lowered (metric_decay complete, `map metric` drop, parent min-decay). First seed (`seedZeroMetrics`) does **not** stamp. Metric_decay treats missing as 1.0 for the drop check.
3. **Agents do not invent these marks.** Skill guidance: on a substantial meaning rewrite, *consider* lowering metrics when the human’s understanding likely dropped; if metrics drop, `decayed` appears automatically.
4. **Todos tab** splits into **Inbox** (`new` / `decayed`) and **Later** (`learn` / `quiz`). Tab count is the sum. **Read all** clears every inbox mark in the ledger; it does not touch Later or work marks.
5. **Read semantics:** leaving a focused node (select another slug) clears that node’s inbox marks via `POST /api/map/inbox/read`. Clear-on-leave (not on enter) so the open inspector still shows New/Decayed chips and the Inbox row does not vanish mid-click. Same clear policy for `new` and `decayed` for now (no confirm).
6. **HTTP:** `POST /api/map/inbox/read` `{ slug }`, `POST /api/map/inbox/read-all`. Mark menus omit inbox kinds from add-lists; chips may still dismiss via unmark.

## Alternatives considered

- Separate non-mark notice table — rejected; reuses marks + Todos chrome with less schema.
- Clear on enter — rejected; Inbox row and chips would disappear before the human sees them.
- Agent-stamped inbox marks — rejected; double-stamps and misses.
- Suppress `new` on init seed — rejected for v1; full inbox on first open is acceptable.

## Consequences

CURRENT and the Todos tab describe Inbox / Later. Skill `drain.md` mentions metric consideration on meaning change. Work marks and Later marks are unchanged by Read all / leave-node.

## Evidence

None beyond this change’s tests.
