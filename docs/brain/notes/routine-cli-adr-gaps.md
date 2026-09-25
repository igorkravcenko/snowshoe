---
status: note
date: 2026-09-25
---

# What is still missing before ADR(s)

Locked enough for a *draft* ADR on: routine vs learning (pointer to existing note), epoch/supersede, CLI families, FSM-owns-transitions, batch-size, multi-complete, agent-computed blast under schema gate, metrics-in-routine.

Still thin / open — grill or specify before calling ADR “accepted”:

1. **JSON Schema (or equivalent) for each principal kind** — `structure_sync`, `blast_radius`, `metric_decay` (required fields, enums, reject rules).
2. **Blast policy** — when empty blast is illegal; how evidence is checked; proposed vs existing nodeIds.
3. **Metric model** — level names, value domain, how parent metrics update from children + own component (vision soft rules → testable rules).
4. **Step granularity** — one blast step vs N; one metric step vs `(node×level)` items; idempotency keys.
5. **Concurrency** — single-agent assumption vs lease/claim on `next` if two polls overlap.
6. **Advance edge cases** — waive policy (default none); behavior if HEAD moves between last complete and advance; refresh vs advance ordering.
7. **Failure / retry** — failed step blocks forever until what? retry same id vs new step id after supersede only?
8. **Artifact storage** — where complete payloads/artifacts live (paths under `.snowshoe/`), size limits, GC across superseding epochs.
9. **Exit codes + CI semantics** — exact mapping for hook/PR-check (signal ≠ review) without inventing product copy.
10. **Naming bikeshed** — `--batch-size` vs `--budget`; keep both as alias or pick one in ADR.
11. **Structure sync definition** — what “model aligned to base..target” means enough to accept (minimal viable accept tests).
12. **Split vs one ADR** — recommend: (A) epoch+routine-vs-learning+metrics-mandatory, (B) CLI+FSM+work queue — or one ADR with clear sections; decide in grill.

Until 1–3 and 6 are at least drafted, an ADR would freeze verbs without freezing the accept-gates that make FSM ownership real.
