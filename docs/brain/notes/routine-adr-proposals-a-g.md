---
status: note
date: 2026-09-25
---

Support for proposed routine ADRs (rev 2). Proposals ≠ truth; ADRs + Appendix are normative for plant.

# Proposals A–G (Brainstormer → CoS grill)

Date: 2026-09-25. Routine only. CoS provisional defaults assumed unless contested below.

For each: **Recommended** · Alternatives · Why.

---

## A. Minimal JSON Schema sketches

### A1. `structure_sync`

**Recommended payload (complete):**
```json
{
  "schemaVersion": 1,
  "base": "<full sha>",
  "target": "<full sha>",
  "ops": [
    {
      "op": "upsert_node",
      "node": {
        "id": "auth",
        "title": "Auth",
        "kind": "module",
        "parentIds": ["api"],
        "codeAnchors": [{ "path": "src/auth/**", "symbol": null }]
      }
    },
    { "op": "retire_node", "nodeId": "legacy-foo", "reason": "removed_from_delta" },
    { "op": "set_edge", "from": "api", "to": "auth", "edgeKind": "contains" }
  ],
  "coverage": {
    "touchedPathsConsidered": true,
    "notes": "optional human/agent note"
  }
}
```

**Required:** `schemaVersion`, `base`, `target`, `ops` (array, may be empty only if accept rules in F allow noop).  
**Enums:** `op` ∈ `upsert_node|retire_node|set_edge|clear_edge`; `kind` free string for v1 (constrain later).  
**Reject if:** `base`/`target` ≠ open epoch; unknown `op`; `retire_node` without `nodeId`; `upsert_node` missing `id`; duplicate contradictory ops in one payload (last-write rejected as whole); `ops` empty when F says non-empty required.

**Alt 1:** Single opaque `artifactPath` to a map file + hash — simpler CLI, weaker inline validate.  
**Alt 2:** Full graph replace each time — easier reason, worse diffs/priors.  
**Why recommended:** op-list is FSM-checkable and merges with prior epochs.

### A2. `blast_radius`

**Recommended:**
```json
{
  "schemaVersion": 1,
  "base": "<sha>",
  "target": "<sha>",
  "nodes": [
    {
      "nodeId": "auth",
      "severity": "contract",
      "parentIds": ["api"],
      "evidence": [
        { "type": "path", "path": "src/auth/session.ts" },
        { "type": "commit", "sha": "<sha in base..target>" }
      ]
    }
  ]
}
```

**Required:** `schemaVersion`, `base`, `target`, `nodes` (array).  
**Enums:** `severity` ∈ `nit|behavior|contract|boundary` (ordered ascending).  
**Reject if:** epoch mismatch; `nodeId` not in model **and** not marked `proposed: true` with matching pending/accepted structure upsert in same epoch; evidence item missing type-specific fields; empty `nodes` when illegal (see B); severity unknown; evidence commit not in `base..target` (when type=commit).

**Alt 1:** path-only blast (no nodeId) — snow maps paths→nodes — more util logic, less agent freedom.  
**Alt 2:** free-text evidence strings — easier agent, weaker gate.  
**Why recommended:** node-centric matches metric queue; structured evidence makes reject real.

### A3. `metric_decay`

**Recommended (one completion item = one node×level, or batch inside one step — see D):**
```json
{
  "schemaVersion": 1,
  "updates": [
    {
      "nodeId": "auth",
      "level": "contracts",
      "value": 0.25,
      "previousValue": 0.8,
      "reason": "severity:contract",
      "blastNodeId": "auth"
    }
  ]
}
```

**Required per update:** `nodeId`, `level`, `value`, `reason`. `previousValue` optional but recommended for audit.  
**Enums:** `level` ∈ metric model C.  
**Reject if:** `level` unknown; `value` ∉ [0,1]; `value` > min(storedPrevious, severityCap) using **stored** previous (missing→1.0); agent previousValue ignored; `nodeId` not in accepted blast set for this epoch; empty `updates` when blast non-empty.

**Alt 1:** discrete bands only (`stale|shaky|partial|solid`) — clearer UX, less math.  
**Alt 2:** snow computes decay from severity tables; agent only confirms blast — less agent work, less flexible.  
**Why recommended:** agent proposes numbers under “no increase in routine” gate; snow still owns accept.

---

## B. Blast policy

**Recommended:**
1. Empty `nodes` **illegal** if either (a) accepted `structure_sync` in this epoch had non-noop ops, or (b) git diff `base..target` is non-empty **and** model has ≥1 node with `codeAnchors` intersecting touched paths.  
2. Empty `nodes` **legal** if diff empty OR model empty (cold bootstrap handles structure first) OR diff touches only paths with no anchors **and** structure step explicitly marked `unmappedPaths: [...]` (still require structure accept first).  
3. Evidence: ≥1 evidence item per blasted node; at least one `path` or `commit` grounded in the delta.  
4. `nodeId` must exist in post-structure model; `proposed: true` only if structure upsert for that id accepted in-epoch.  
5. Parents listed must exist; snow may add parent propagation later — v1 agent-supplied `parentIds` are hints, snow validates existence only.

**Alt 1:** empty blast always illegal whenever diff non-empty (stricter, noisy on docs-only commits).  
**Alt 2:** snow auto-fills blast from anchors; agent only adjusts severity — safer, less agentic.  
**Why recommended:** balances honesty vs docs-only noise; keeps agent as blast function under gate.

---

## C. Metric model v1

**Levels (3):** `overview` | `contracts` | `internals` (meanings unchanged).

**Canonical domain:** float **0.0–1.0** in storage/CLI/schema.  
**UI bands only** (not a value type): stale [0,0.25), shaky [0.25,0.5), partial [0.5,0.75), solid [0.75,1].

**Accept:** `value ≤ min(storedPrevious, severityCap)`; missing stored → **1.0**. Agent `previousValue` = audit hint; **ignore for ≤ check**.

**Parent update:** min-decay only; `contracts` min(all children) known crude; future participant edges. Children ≠ parent.

**Alt:** discrete storage bands — rejected (CoS: float canon + UI bands).

---

## D. Step granularity + idempotency

**Recommended:**
- **Exactly one** `blast_radius` step per epoch (id stable: `blast:<epochId>`).  
- **One** `structure_sync` step per epoch (`structure:<epochId>`), may complete once with full op list (rework = new complete on same id while pending/failed).  
- **Metric:** many steps `metric:<epochId>:<nodeId>:<level>` for each blasted node × affected levels (severity table decides which levels must update).  
- `next --batch-size N` returns up to N pending agent-do items.  
- Idempotency key = step `id`. Re-complete same id while `pending`/`failed` replaces payload attempt; after `accepted`, further complete → reject unless epoch superseded.

**Severity → required levels (v1 table in snow):**  
`nit` → `internals` only; `behavior` → `internals`+`contracts`; `contract`/`boundary` → all three.

**Alt 1:** single batched `metric_decay` step with `updates[]` — fewer round trips, worse partial progress.  
**Alt 2:** many blast steps per node — more parallel, harder empty-blast policy.  
**Why recommended:** one blast keeps policy simple; fine-grained metrics match batch queue and partial complete.

---

## E. Advance edge cases + refresh ordering

**Recommended:**
1. `advance` allowed iff open epoch, all required steps `accepted`, and `gitHead == epoch.target` (or detached policy: `target` still reachable).  
2. If `gitHead != epoch.target` → **reject advance** with `stopHint: refresh_required`; agent/hook must `routine refresh` (supersede) before more work.  
3. Ordering: always `refresh` before assuming queue; `advance` never implies refresh.  
4. Between last `complete` and `advance`, if HEAD moved → refresh path, not silent advance to old target.  
5. Waive: none (CoS default).

**Alt 1:** allow advance to old target while HEAD moved (freeze) — clearer “finish T1 first”; delays HEAD honesty.  
**Alt 2:** auto-refresh inside advance — hides supersede, dangerous.  
**Why recommended:** matches locked superseding-epoch story; HEAD is source of target intent.

---

## F. Structure sync MV accept tests

**Recommended “aligned enough” when payload accepted AND all hold:**
1. `base`/`target` match open epoch.  
2. Every path in `git diff --name-only base..target` is either (a) listed under some node’s `codeAnchors` after ops, or (b) listed in `coverage.unmappedPaths`, or (c) matches ignore globs from config (e.g. `*.md` optional).  
3. No `retire_node` for an id still referenced by non-retired edges.  
4. All `upsert_node.id` unique; graph references resolve.  
5. Cold start (no nodes yet): ops may create a minimal root + first-layer nodes; empty ops rejected.

**Alt 1:** only validate schema, defer coverage to later epoch — faster v0, lies about alignment.  
**Alt 2:** require 100% path mapping, no unmapped — too strict for monorepos.  
**Why recommended:** explicit unmapped keeps honesty without perfection theatre.

---

## G. Exit codes (hook / PR-check)

| Code | Meaning |
|---|---|
| 0 | Ok / idle: `base == HEAD` and no open blocking epoch **or** command succeeded with no residual required work |
| 1 | Attention: open epoch with pending/failed required steps, or `base != HEAD`, or advance refused because work remains / refresh required |
| 2 | Usage / invalid args / invalid JSON envelope |
| 3 | Internal / IO / corrupt state |

**Command nuances:**
- `routine status`: 0 if idle & caught up; 1 if behind or blocked.  
- `routine advance`: 0 on success; 1 if cannot advance; 2 bad invocation.  
- `work complete`: 0 if **all** completions in the request accepted; 1 if any rejected/partial (body lists per-id); 2 bad payload envelope.  
- `work next`: 0 if batch returned or clean idle stop; 1 optional unused — prefer 0 + `stop` in JSON to avoid CI false fail on next.

PR-check / hook should call **`routine status`** (or refresh+status), not `work next`. Signal ≠ review remains product copy elsewhere.

**Alt:** use 1 for “batch non-empty” on next — confuses automation.  
**Why recommended:** status/advance carry the red signal; next is agent UX.

---

## Contested vs CoS defaults

No strong contest. Adopted: split ADRs, `snowshoe` spelling, `--batch-size`, single-agent+leaseToken, waive none, fail/retry rules, artifacts path.
