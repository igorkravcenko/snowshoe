---
status: note
date: 2026-09-26
---

# Detail queue and mental map (worker protocol)

Status: **draft note for plant** (not ADR, not CURRENT).  
Date: 2026-09-26  
Locks: Igor + Brainstormer; CoS resolve 2026-09-26; storage Tech Lead.

## Intent

Snowshoe keeps a rough personal mental map. Unexpanded parts look gray in the UI. The user can mark a node for **detailization** (expand one hop). That enqueues a todo; the node shows **pending** until an external agent (skill → CLI worker) completes it. Snowshoe does **not** spawn agents in v1.

Temporary sync after external writes: **reload** the map (no filesystem watch yet).

## Relationship to routine

- Same work bus: `snowshoe work next` / `work complete`.
- New step kind: `detail`.
- **Detail never blocks** `routine advance` / moving `base` (same class as learning).
- When both routine epoch steps and detail todos are pending: **drain required routine steps first** so catch-up is not starved by map painting.
- Failure policy is **per-kind**:
  - `detail`: **no `work fail` in v1** — only done / not-done.
  - `structure_sync` / `blast_radius` / `metric_decay`: keep `work fail` as in proposed ADR-B until that ADR is revised.

## Storage (constraint)

- **SQLite** is SoT: graph index, code anchors, metrics, FSM, leases (`.snowshoe/ledger.sqlite`).
- **Markdown** is human prose only, by ref (`proseRef` → `.snowshoe/map/nodes/<slug>.md`). Missing prose ≠ missing node.
- Epoch worker blobs stay under `.snowshoe/epochs/<epochId>/…`.
- `work complete` envelopes stay small: paths + slim structured delta. Reject if metrics or step status appear only in markdown.

## Identifiers and vocabulary

- Canonical node id field: **`slug`** (unique; util validates). Structure payloads may alias `id` → `slug`.
- Graph role field: **`type`** (entity catalog below). Do not call entity types “levels”.
- Metric axis stays separate: floats on `(node × understanding dimension)` per ADR-A; display bands are UI-only.
- Avoid overload with blast severity words: entity types use `surface` / `external`, not `contract` / `boundary`.

## Entity types (v1 catalog)

| type | role | notes |
|------|------|--------|
| `system` | repo / product root | children: `module`, `external` |
| `module` | package / area | children: `module`, `surface`, `flow`; may be leaf if `leaf: true` + anchors |
| `surface` | API / interface face | was informal “contract”; children: `flow`, `symbol` |
| `flow` | end-to-end behavior | children: `symbol`, `module` |
| `symbol` | code leaf (fn/type) | **always leaf** in v1 |
| `external` | outside system / IO | was informal “boundary”; children: `surface`, `flow` |

Parent/child **matrix** is data in the util (starter matrix in implementation); not hardcoded forever. Detail = add allowed child types under the parent, not “numeric level N→N+1”.

Gray / expandable: allowed children nonempty and not marked leaf, and either no children yet or user marked detail again for more fill.

## Metrics on create

- Brand-new nodes from detail: util sets understanding **0.0** (unknown).
- Agent must not send metric fields; if present → **ignore** (not reject).
- Distinct from ADR-A decay rule: missing stored previous on an *existing* cell → treat as **1.0** for ≤ checks.

## Detail FSM

`pending → leased → done`

- User **cancel** only from `pending` in v1 (leased waits TTL / reclaim; force-break later).
- Lease TTL / reclaim of same step id → back to `pending`; new claim **invalidates** prior `leaseToken`.
- `unchanged: true` is a valid complete; clears pending with no graph growth.
- No fail state for `detail`.

## User-initiated ops (map side)

- Navigate map (read-only).
- Mark detail → enqueue `kind=detail`, show pending.
- Cancel todo (pending only).
- Reload map.
- Agent-as-client: `work next` / `work complete` (and routine commands unchanged).

## Agent steps

1. `snowshoe work next` → `{ stepId, kind: "detail", leaseToken, parentSlug, allowedChildTypes[], priorArtifactRefs? }` (routine steps preferred when epoch requires them).
2. Read code/docs in parent scope; write optional prose under allowed root; build one-hop children.
3. `snowshoe work complete` with one completion per parent todo (batch = `completions[]`).
4. Util validates → writes SQLite (metrics 0 for new nodes) → pending cleared.

## Completion payload (sketch)

```json
{
  "id": "step-…",
  "leaseToken": "…",
  "kind": "detail",
  "payload": {
    "parentSlug": "auth",
    "nodes": [
      {
        "slug": "auth-session",
        "title": "Session",
        "type": "module",
        "op": "upsert",
        "leaf": false,
        "proseRef": ".snowshoe/map/nodes/auth-session.md",
        "anchors": [{ "path": "src/auth/session.ts", "symbol": "createSession" }]
      }
    ],
    "edges": [
      { "from": "auth", "to": "auth-session", "kind": "parent" }
    ],
    "unchanged": false
  }
}
```

### Accept rules

**Hard reject:** bad leaseToken; type ∉ catalog; parent/child matrix forbid; `proseRef` outside allowed root; slug clash when not upsert; edges to unknown slugs after applying the batch; metrics treated as SoT from agent.

**Soft (accept + warn):** missing/moved anchor file paths → still write node; response includes `anchorsUnresolved[]`. (Routine structure coverage gates stay hard per ADR-B — different gate.)

**Batch:** one completion ↔ one parent detail todo; partial accept OK; cross-item slug conflicts reject the conflicting items.

Flexible **upsert**: create or update existing children in the same todo.

## Explicit non-goals v1

- Snowshoe spawning workers.
- `work fail` for `detail`.
- Watch/fs sync (reload only).
- Markdown as SoT for graph/metrics.
- Folding this into ADR-B appendix (separate note now; later separate proposed ADR + small ADR-B amend for `kind=detail`, per-kind fail policy, slug alias).

## Follow-ups (not this note)

- Proposed ADR: map/detail + entity catalog.
- Amend ADR-B on promote: `detail` on bus, per-kind fail, `id`/`slug` and `kind`/`type` aliases.
- Force-cancel while leased; optional hard anchors later.

## Evidence

- CoS critique 2026-09-26 on DETAIL_QUEUE_PROPOSAL.
- Tech Lead storage split (SQLite SoT, prose by ref).
- Proposed ADR-A/B in PR #3 (routine); this note extends the work bus without gating `base` on detail.
