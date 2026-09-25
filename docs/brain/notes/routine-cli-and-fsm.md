---
status: note
date: 2026-09-25
---

# Note: Routine CLI shape + FSM ownership (locked intent)

**Status:** locked in discussion with Igor (2026-09-25). Not CURRENT. Candidate material for ADR after grill gaps below are closed.  
**Companion:** [routine-epoch-metrics.md](./routine-epoch-metrics.md) (epochs, routine vs learning, mandatory metrics).  
**Proposed ADR (not CURRENT):** [ADR-2026-09-25-routine-cli-and-fsm.md](../DECISIONS/ADR-2026-09-25-routine-cli-and-fsm.md).  
**Scope:** **routine only** (обучение deferred). Concrete command *families* are locked; exact JSON Schema bodies and flag spelling may still tighten in ADR.

Informal *snow* is not a naming decision and is not the CLI binary; examples use provisional `snowshoe …` (binary name TBD).

## Command families

| Command | Role |
|---|---|
| `snowshoe init` | One-time repo setup (`.snowshoe`, personal gitignore). |
| `snowshoe routine refresh` | Ensure or supersede epoch from HEAD (or explicit target). |
| `snowshoe routine status` | Epoch progress without claiming work. |
| `snowshoe routine advance` | Atomically set `base := target` iff FSM allows (`canAdvance`). |
| `snowshoe work next` | Claim a **batch** of agent-doable routine steps. |
| `snowshoe work complete` | Submit one or more step payloads for acceptance. |
| `snowshoe work fail` | Request failure transition(s) for step(s). |

Shared conventions (aligned with product CLI+JSON intent): `--json`, non-interactive, common envelope fields (`schemaVersion`, `command`, `ok`, `repoRoot`, `gitHead`), heavy data via artifact refs/paths. Exit codes: `0` ok, `1` work remaining / cannot advance, `2` usage, `3+` internal.

### Batch size (not tokens)

- **No token-budget flags** (the util does not control model tokens).
- `snowshoe work next --batch-size N` (alias `--budget N` acceptable) = max **number of work items** returned in one poll.
- Never return the full ranked queue; return batch + stop/remaining hints.

### Multi-complete

`snowshoe work complete --json` accepts multiple completions in one call, e.g. `completions: [{ id, payload }, …]`.  
Response is **per-id** `accepted` | `rejected` (+ reasons). Partial success is allowed.

`snowshoe work fail` may similarly accept a list; lower priority than complete.

## FSM ownership (the util) vs agent body

**Snowshoe owns** the routine state machine: which steps exist, dependencies, statuses, `canAdvance`, `advance`, and whether a submitted payload **accepts** a transition.

**Agent owns** the *content* of payloads for open steps, submitted only through the fixed CLI protocol.

Agent must **not** assert `status: done`. It only calls `complete` / `fail` with bodies; the util validates and transitions (or rejects).

This is **not** an absolute rule for every future kind, but it **is** required for principal routine kinds: at least `blast_radius`, `metric_decay`, and `routine advance`. Structure sync should follow the same accept-gate pattern once its schema exists.

### Per-kind input contract

Closing a step requires a **kind-specific payload** validated by the util (JSON Schema or equivalent). Rejected payload ⇒ step stays pending (or moves to failed only via explicit fail path / policy).

## Routine phases (unchanged order)

1. Ensure / supersede epoch (`routine refresh`)
2. Structure sync (agent payload → util accept)
3. Blast radius — **computed by agent**, accepted only under hard CLI contract
4. Metric decay on blast `(node × level)` — required; blocks `base` advance
5. `routine advance` when all required steps accepted

Learning / verify / paint-green remain out of routine.

## Blast contract (intent)

- Agent performs blast over `base..target` (+ model) and submits payload.
- Snowshoe validates schema, node identity rules, and policy checks (e.g. empty blast vs non-empty structural diff — exact policy still open).
- Only after accept does FSM mark blast done and open metric-decay work items.

Illustrative payload shape (not final schema):

```json
{
  "schemaVersion": 1,
  "nodes": [
    {
      "nodeId": "auth",
      "severity": "nit|behavior|contract|boundary",
      "parentIds": ["api"],
      "evidence": ["path:…", "commit:…"]
    }
  ]
}
```

## Prior on steps

Unchanged: util exposes facts `prior: { doneAtTarget, artifactRef } | null`; agent decides whether to read. No util-side Reuse/Seed/Blind automation.

## Agent loop (skill-shaped)

```
refresh → loop( status | next → complete/fail ) → advance if canAdvance → refresh/idle
```

On `recomputed` / superseding epoch: do not complete stale step ids from memory.

## Explicitly not locked here

- Exact JSON Schemas for `structure_sync`, `blast_radius`, `metric_decay`
- Severity taxonomy final list and parent-propagation rules
- Metric level names and value types
- Whether blast/metrics run as many fine steps vs one batched step
- Claim/lease semantics if two agents race
- Hook/CI copy and exit-code mapping details beyond the sketch
- Invoking agent backends from Snowshoe (still external loop + skill)

## Gaps before ADR

See [routine-cli-adr-gaps.md](./routine-cli-adr-gaps.md).
