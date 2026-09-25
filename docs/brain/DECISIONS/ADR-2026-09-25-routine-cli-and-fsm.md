---
status: proposed
date: 2026-09-25
---

# ADR-2026-09-25: Routine CLI families, FSM ownership, work queue

## Status

Proposed (draft for grill). Not CURRENT. Companion: [ADR-2026-09-25-routine-epoch-and-metrics.md](./ADR-2026-09-25-routine-epoch-and-metrics.md).

## Context

An external agent loop (skill + harness) will drive routine. The util must own transitions so “I did everything” cannot paint progress. Polling must return batches, not one item and not the full queue. Informal chat shorthand *snow* is not the CLI binary name.

## Decision

### CLI spelling

Provisional binary / UX spelling: **`snowshoe …`**. Do not treat informal *snow* as the locked CLI name (see provisional-name ADR).

### Command families

| Command | Role |
|---|---|
| `snowshoe init` | Repo setup |
| `snowshoe routine refresh` | Ensure or supersede epoch from HEAD (or explicit target) |
| `snowshoe routine status` | Progress without claiming work |
| `snowshoe routine advance` | `base := target` iff FSM allows |
| `snowshoe work next` | Claim a batch of agent-doable steps |
| `snowshoe work complete` | Submit one or more payloads for accept/reject |
| `snowshoe work fail` | Request failure transition(s) |

Flags: `--json`; **`--batch-size N`** on `work next` (max items). `--budget` may appear as deprecated alias only — same meaning, not a second concept. **No token-budget flags.**

Envelope (intent): `schemaVersion`, `command`, `ok`, `repoRoot`, `gitHead`; heavy blobs via paths under `.snowshoe/epochs/<epochId>/…`. GC of superseded epoch dirs is best-effort later (not an intent blocker).

### FSM ownership

Snowshoe owns step graph, statuses, dependencies, `canAdvance`, and accept/reject of payloads.  
Agent submits **bodies only** via `complete` / `fail`. Agent never asserts `status: done`.

Principal kinds under hard gate: `structure_sync`, `blast_radius`, `metric_decay`, plus `routine advance`.

`work complete` accepts `completions: [{ id, payload, leaseToken }]`. Response per-id `accepted|rejected`. Partial success allowed (exit `1` if any rejected).

### Concurrency v1 (leases)

Single-agent assumption. `work next` **claims** steps and returns a **leaseToken** per claimed item.

- `complete` / `fail` without a matching current leaseToken → **reject**.  
- A later `work next` that reclaim the **same** step id **invalidates** the previous leaseToken. “Last claimer wins” means exactly this — not silent dual-accept of two payloads.  
- Lease TTL is implementation-defined (suggested 15–60 minutes); expired lease → reject complete until re-claimed.

No multi-agent orchestration in v1.

### Failure / retry

Failed step blocks advance until (a) a later `complete` on the **same** step id is accepted, or (b) a superseding epoch recomputes steps. No silent auto-retry.

### Granularity

- One `structure_sync` step per epoch: `structure:<epochId>`  
- One `blast_radius` step per epoch: `blast:<epochId>`  
- Many `metric_decay` steps: `metric:<epochId>:<nodeId>:<level>` for each required level  

Idempotency key = step `id`. Re-complete while `pending`/`failed` replaces the attempt; after `accepted`, further complete → reject unless epoch superseded.

### Severity → required metric levels

| Blast severity | Required metric levels to open |
|---|---|
| `nit` | `internals` |
| `behavior` | `internals`, `contracts` |
| `contract` | `overview`, `contracts`, `internals` |
| `boundary` | `overview`, `contracts`, `internals` |

### Severity caps (accept upper bound)

On metric accept, `value` must be `≤ min(storedPrevious, severityCap)` where `storedPrevious` is util state (missing → `1.0`), and caps are:

| Severity | `internals` | `contracts` | `overview` |
|---|---|---|---|
| `nit` | ≤ 0.85 | (not required / no cap from nit) | (not required / no cap from nit) |
| `behavior` | ≤ 0.60 | ≤ 0.75 | (not required) |
| `contract` | ≤ 0.45 | ≤ 0.45 | ≤ 0.45 |
| `boundary` | ≤ 0.30 | ≤ 0.30 | ≤ 0.30 |

If a level is not in the required set for that severity, no metric step is opened for it from that blast row.

### Blast policy (summary)

- Agent computes blast; the util validates schema + policy (Appendix).  
- Empty `nodes` **illegal** when structure was non-noop or anchored paths in `base..target` were touched (see Appendix reject rules).  
- Empty `nodes` **legal** in the empty-diff / no-anchor / explicit unmapped cases in Appendix → **zero metric steps**; advance may follow structure + empty blast.  
- Evidence required per blasted node; `nodeId` must exist post-structure (or proposed + accepted upsert).  
- Default path ignore-globs for coverage: **empty** until config exists.

### Advance / refresh ordering

`advance` requires all required accepted **and** `gitHead == epoch.target`. Else reject with refresh required. `advance` never auto-refreshes. Waive: none.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success / idle caught-up (for status) |
| 1 | Attention: behind HEAD, blocked epoch, cannot advance, or partial/any complete reject |
| 2 | Usage / invalid envelope |
| 3+ | Internal / corrupt state |

Hooks and PR-checks should use `routine refresh` + `routine status` (or status alone): **signal ≠ review**. Prefer `work next` exit 0 with JSON `stop` for agent loops.

## Appendix: Minimal payload sketches + reject rules

Normative sketches for accept gates (illustrative JSON; implement as JSON Schema later). Support write-up: `docs/brain/notes/routine-adr-proposals-a-g.md`.

### A. `structure_sync`

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
    }
  ],
  "coverage": {
    "touchedPathsConsidered": true,
    "unmappedPaths": []
  }
}
```

**Reject if:** epoch `base`/`target` mismatch; unknown `op`; missing ids; unresolved edge refs after ops; empty `ops` on cold-start (no nodes yet); coverage fails — every path in `git diff --name-only base..target` must be anchored, listed in `unmappedPaths`, or match configured ignore-globs (default: none).

### B. `blast_radius`

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

**Reject if:** epoch mismatch; unknown severity; missing evidence; commit evidence outside `base..target`; `nodeId` unknown and not proposed+structure-accepted; empty `nodes` when illegal (structure non-noop **or** anchored touched paths); parentIds reference missing nodes.

**Accept empty `nodes` only if:** diff empty, or model has no intersecting anchors and structure coverage listed unmapped/ignores appropriately (honest “nothing to blast”).

### C. `metric_decay` (per step or batched updates inside one step id)

```json
{
  "schemaVersion": 1,
  "updates": [
    {
      "nodeId": "auth",
      "level": "contracts",
      "value": 0.25,
      "previousValue": 0.8,
      "reason": "severity:contract"
    }
  ]
}
```

**Reject if:** level unknown; `value` ∉ [0,1]; `nodeId` not in accepted blast set; level not required for that node’s severity; `value` > `min(storedPrevious, severityCap)` using **stored** previous (missing → 1.0). Agent `previousValue` ignored for the inequality (audit only).

## Alternatives considered

- Token budget on `next` — rejected.  
- Agent-declared done without payload schema — rejected.  
- Util-only blast — deferred.  
- Single mega `metric_decay` step — rejected as default.  
- Dual-accept under two leases — rejected; reclaim invalidates prior lease.  
- Trust agent `previousValue` — rejected.

## Consequences

- Skills document `snowshoe` invocations + lease/complete protocol.  
- Index DECISIONS README when accepted.  
- Do not promote CURRENT in this package.  
- Severity caps / UI band thresholds may be tuned without changing float storage.

## Evidence

- `docs/brain/notes/routine-cli-and-fsm.md`  
- `docs/brain/notes/routine-cli-adr-gaps.md`  
- `docs/brain/notes/routine-adr-proposals-a-g.md`  
- `docs/brain/notes/routine-epoch-metrics.md`
