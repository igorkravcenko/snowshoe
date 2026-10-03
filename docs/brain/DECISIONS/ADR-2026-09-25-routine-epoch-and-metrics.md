---
status: proposed
date: 2026-09-25
---

# ADR-2026-09-25: Routine epochs, learning split, mandatory metric decay

## Status

Proposed (draft for grill). Not CURRENT. Companion: [ADR-2026-09-25-routine-cli-and-fsm.md](./ADR-2026-09-25-routine-cli-and-fsm.md).

## Context

Snowshoe must keep a project mental model honest relative to git without blocking on human study. Personal comprehension (learning) is on-demand and must not gate sync. Understanding *metrics* must still be trustworthy after sync — otherwise the map lies. Retargeting HEAD while sync is half-finished must not keep stale checkmarks.

## Decision

### Routine vs learning (variant B)

| | **Routine** | **Learning** |
|---|---|---|
| Purpose | Align project model + understanding metrics to git | Human raises understanding (explain/quiz/green) |
| Human required? | No | Yes (on request) |
| Tied to commits? | Yes (`base`↔`target` epoch) | No |
| Blocks advancing `base`? | Yes until required steps accepted | No |

### Epoch

An open **epoch** records:

- `base` — last commit where model + post-routine metrics are fully applied  
- `target` — commit we sync toward (normally HEAD after refresh)  
- `epochId`  
- required steps + statuses  
- partial artifacts under `.snowshoe/epochs/<epochId>/…`

Work is reasoned from `base`. **`base` advances to `target` only when all required routine steps are accepted.** Default **waive: none**.

### Superseding epoch

If `target` / HEAD moves before completion:

1. Do not silently rewrite target on the open epoch.  
2. Open superseding epoch: same `base`, new `target`, new `epochId`.  
3. Recompute required steps from `base..newTarget`.  
4. Prior completions are not auto-done; steps may expose `prior: { doneAtTarget, artifactRef }` for the agent to optionally read.

### Mandatory routine contents

Required, in order of dependency:

1. **Structure sync** — model ops for `base..target`  
2. **Blast radius** — affected nodes (agent-computed, schema-gated; see companion ADR)  
3. **Metric decay** — update metrics for blasted `(node × level)` so values stay honest  

Without (3), metrics are not trustworthy → (3) blocks `base` advance.

**Empty blast:** if `blast_radius` is accepted with zero nodes, the metric queue is empty; advance may proceed after structure (+ empty blast) only — no metric steps required.

### Metric model v1 (provisional)

**Levels:** `overview` | `contracts` | `internals`.

**Storage / accept domain:** float **`0.0–1.0`** inclusive. This is the only value type in CLI/schema.

**UI bands (display only, not a schema type)** — provisional thresholds:

| Band | Range |
|---|---|
| `stale` | `[0, 0.25)` |
| `shaky` | `[0.25, 0.5)` |
| `partial` | `[0.5, 0.75)` |
| `solid` | `[0.75, 1]` |

**Accept gate (Snowshoe-owned):** compare submitted `value` to **stored** previous for that `(nodeId, level)`. If no stored value, treat stored previous as **`1.0`**. Agent-supplied `previousValue` in payload is an **audit hint only** — prefer **ignore + use stored** (do not trust agent for the ≤ check). Reject if `value` outside `[0,1]`.

Routine must not raise trust: accepted `value` must be `≤ min(storedPrevious, severityCap(severity, level))` where severity comes from the accepted blast row for that node (see companion ADR caps + severity→levels table). Learning-time increases are out of scope here.

**Parent updates (v1):** after child metric accepts, the util may **decay** parent metrics via deterministic min-rules (never auto-increase). Parent `contracts` using `min(all children.contracts)` is **known crude**; future work = contract-participant edges. Children accepted ≠ parent understood; parent `internals` are not auto-derived from children.

### Out of scope

Learning CLI, verify/green protocol, team sharing, snowshoe invoking agent backends.

## Alternatives considered

- **Variant A** (base waits on human verify) — rejected for wedge speed; metrics honesty handled inside routine instead.  
- Metric updates optional / learning-only — rejected; metrics would lie after sync.  
- Discrete bands as storage type — rejected; float is canonical, bands are UI projection.  
- Freeze target until epoch finishes (ignore new HEAD) — deferred as alt; supersede-to-HEAD preferred for “catch up after pull.”  
- Deeper level taxonomy (`why`, …) — deferred; three levels for v1.  
- Trust agent `previousValue` for ≤ check — rejected; enables fake raises.

## Consequences

- CURRENT should cite this once accepted (CoS / product owner promote — not this package).  
- CLI/FSM, schemas, severity tables live in companion ADR.  
- Implementation pre-code until accepted.  
- Parent contracts aggregation may be refined later without changing float storage.

## Evidence

- `docs/brain/notes/routine-epoch-metrics.md`  
- `docs/brain/notes/routine-adr-proposals-a-g.md`  
- Vision discussion (progressive detail; parent ≠ children without own assessment)
