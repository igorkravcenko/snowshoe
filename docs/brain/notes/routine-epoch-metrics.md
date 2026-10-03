---
status: note
date: 2026-09-25
---

# Note: Routine, learning, epochs, metrics (locked intent)

**Status:** working note locked in discussion with the product owner (2026-09-25). Not CURRENT. Not ADR yet — grill before promoting claims into CURRENT.  
**Scope:** product semantics only. **No concrete CLI command shapes** in this note.  
**Companion (CLI families / FSM):** [routine-cli-and-fsm.md](./routine-cli-and-fsm.md).  
**Proposed ADR (not CURRENT):** [ADR-2026-09-25-routine-epoch-and-metrics.md](../DECISIONS/ADR-2026-09-25-routine-epoch-and-metrics.md).

## Terminology

| Term | Meaning |
|---|---|
| **Routine** | Model sync: bring the project mental model and understanding *metrics* in line with git. **No human required.** Blocks advancing `base` until required steps are done. |
| **Learning** | Human-driven comprehension work (explain, quiz, deepen understanding). On request, arbitrary volume. **Must not block** other workflow. **Not tied to commits** / base↔target. |

Variant **B** (decoupled): advancing model `base` does **not** wait on human learning or verified-green. Trustworthy *metrics after routine* ≠ “human is green again.”

## Epoch (routine only)

Routine work is tracked in an explicit **epoch**:

- `base` — last commit at which the model (and metrics post-routine) are considered fully applied.
- `target` — commit we are currently syncing toward (typically current HEAD after pull).
- `epochId` — id of this sync attempt.
- Required routine steps with statuses (`pending` / `done` / …), bound to this epoch.
- Partial artifacts accepted inside the epoch before `base` moves.

**Invariant:** `base` advances to `target` only when all **required routine** steps for that epoch are done (or explicitly waived by policy — default: no waive without human/product rule). Learning backlog must not gate this.

Work inside an epoch is always reasoned from **`base`**, not as if `base` had already moved.

## Target moves while routine is partial (superseding epoch)

If `target` changes again before the routine finishes:

1. Do **not** silently rewrite `target` on the open epoch and keep old checkmarks.
2. Open a **superseding** epoch: same `base`, new `target`, new `epochId`, `supersedes` prior epoch.
3. **Recompute** required steps from diff `base..newTarget` (not “append tail” from old target).
4. Prior epoch step completion is **not** automatically “done” for the new epoch.

Done-ness should be attributable to something like `(epochId, stepId, …)` plus enough identity of what was done (e.g. content/diff identity) so false progress cannot survive a retarget.

## Prior artifacts (agent loop)

Snowshoe does **not** auto-decide reuse vs blind rewrite. The util exposes **facts** on a step, e.g.:

- This step was completed when the epoch target was commit `doneAtTarget`
- Link / ref to the artifact from that completion (or null)

The **agent** (in the same poll/work loop) decides whether to read the artifact and how much the new `target` has moved relative to `doneAtTarget`.  
Revalidation is **not** a separate runtime: it is normal routine steps in the same agent loop. (Invoking agent backends from snow itself is out of scope for now — loop is driven externally via util + skill.)

## Mandatory routine contents (intent)

Required routine includes at least:

1. Sync / update model structure for `base..target` as needed.
2. Determine **blast radius** (affected nodes; parents carefully per severity).
3. **Decay / update understanding metrics** on affected `(node × metricLevel)` so metrics stay honest vs the delta.

Without (3), metrics cannot be trusted after sync — so metric update is **required**, human-free, and **blocks** `base` advance.

After a closed routine: metrics are consistent with `base == target` for that sync. Raising understanding again is **learning**, not routine.

## Learning vs metrics

- **Metric decay/update** = routine (automated honesty).
- **Explain / quiz / “learn until green”** = learning (human request).
- Learning status can go stale when the world/model moves; routine is what applies that staleness to metrics. Human re-learning is optional and unbounded.

## Node ↔ understanding (intent, still soft)

Not locked as “deeper understanding = only child nodes.”

- A **node** is a model entity; may have children as finer *system* slices.
- A node may carry **several metric dimensions** (levels of abstraction/depth, e.g. overview / contracts / internals — exact names open).
- Composite metrics: partially from children **plus** an own component children do not cover.
- **Children done ≠ parent done** without the parent’s own assessment.
- Progressive detail: cheap high-level model first; deepen on demand.
- Blast heuristic (from vision): leaf nits barely move the top; contract/boundary breaks redden the node and up the chain more strongly.

Metric routine queue is conceptualized as work on **`(node × metricLevel)`** in blast radius, not a separate “learning epoch.”

## Agent work queue (intent only)

- Ranked / pollable work owned by the util; agent takes **batches** (not one item, not full dump).
- Completing a chunk is reported back to the util; util drops or advances that step.
- Clear stop when no more agent-doable routine work (or human-only work remains — learning is outside mandatory stop-for-base).
- Do not hand the agent a full ranked dump of everything every cycle.
- Separate kinds so agent cannot “complete” human learning as routine.

Concrete command names, JSON field lists, and exit-code mapping are **intentionally omitted** here.

## Non-goals in this lock

- Concrete `snow …` CLI surface
- Exact metric level taxonomy
- Map UI shape (tree/graph/vault)
- Team sharing of competence maps
- Snow invoking agent backends (dual entry later)

## Promotion path

When grilled: thin ADR(s) for (1) routine vs learning + B, (2) epoch / supersede / prior facts, (3) metrics-as-required-routine — then CURRENT bullets. Until then this note is the durable discussion lock.
