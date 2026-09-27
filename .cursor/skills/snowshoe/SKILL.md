---
name: snowshoe
description: >-
  Drive the Snowshoe CLI drain loop (no learning): init, routine status/refresh,
  work next/complete, routine advance, map status. Use after pull, when catching
  up a personal repo map, or when the human is trying the E2E map UI. Never write
  SQLite, never spawn agents, never install hooks, never fail detail steps.
---

# Snowshoe skill (v1 drain, no learning)

You are an **external worker**. Snowshoe does **not** spawn you. Drive the CLI; the util owns the ledger.

In this repo the binary is `bun src/index.ts` (or `bun run snowshoe`). If `snowshoe` is on PATH, use that. Always pass `--json` so you can parse results.

## Hard rules

- Never open or write `.snowshoe/ledger.sqlite`.
- Never install git hooks. Never spawn agents or watch the filesystem.
- Never call `work fail` on `kind=detail` (detail has no fail in v1).
- Never submit `type: "system"` in a detail payload. Root slug `root` is util-owned.
- Do not start `map serve` unless the human asked; the UI is their face, not yours.
- Do not call `work complete` from a map UI. You complete work; they reload.

## Commands you run

```bash
bun src/index.ts init --json
bun src/index.ts routine status --json
bun src/index.ts routine refresh --json
bun src/index.ts work next --json --batch-size 1
bun src/index.ts work complete --json          # JSON envelope on stdin
bun src/index.ts work fail --json              # routine kinds only — never detail
bun src/index.ts routine advance --json
bun src/index.ts map status --json
```

`work complete` / `work fail` read JSON from **stdin** (or `--input '<json>'`).

## Default drain loop

```
loop:
  status ← routine status --json
  if status says HEAD/target moved or needs refresh:
    routine refresh --json
  batch ← work next --json --batch-size 1
  if batch.items is empty:
    if status.canAdvance (or advance is allowed): routine advance --json
    STOP  (queue empty / idle until next invocation)
  for step in batch.items:
    do the work for step.kind (below)
    write allowed artifacts only under .snowshoe/…
    work complete with { schemaVersion: 1, completions: [{ id, leaseToken, kind, payload }] }
    if result is hard reject: STOP and report reasons
  if operator interrupt or budget exhausted: STOP and report
```

**Stop rules:** queue empty; batch/budget done; unrecoverable hard reject (bad lease, matrix forbid, proseRef outside `.snowshoe/map/`); operator interrupt.

**Routine-first:** the util orders `structure_sync` → `blast_radius` → `metric_decay` before `detail`. Do not try to drain detail while required epoch steps are pending.

## Init → seed (HP1)

1. `init --json` — creates local `.snowshoe/` (gitignored). No hooks. Util auto-enqueues root `detail` (`parentSlug=root`).
2. `work next` → expect `kind=detail`, `parentSlug=root`, `allowedChildTypes` includes `module` / `external`.
3. One-hop upsert **under** root. Children `type` ∈ `module|external` (not `system`).
4. `work complete` then the human reloads the map UI.

### Detail complete payload

Inner payload must match `docs/brain/schemas/detail-complete.schema.json`. Outer envelope is ADR-B-style `completions[]`.

```json
{
  "schemaVersion": 1,
  "completions": [
    {
      "id": "<stepId>",
      "leaseToken": "<leaseToken>",
      "kind": "detail",
      "payload": {
        "parentSlug": "root",
        "unchanged": false,
        "nodes": [
          {
            "slug": "cli",
            "title": "CLI",
            "type": "module",
            "op": "upsert",
            "leaf": false,
            "anchors": [{ "path": "src/cli.ts", "symbol": "main", "startLine": 1 }]
          }
        ],
        "edges": [{ "from": "root", "to": "cli", "kind": "parent" }]
      }
    }
  ]
}
```

- Omit metrics (util sets `0.0` on create; extra metric fields are ignored).
- `unchanged: true` with empty nodes/edges is valid (clears pending, no graph growth).
- `proseRef` if used must stay under `.snowshoe/map/`.
- Missing/moved anchor files: util **accepts** and returns `anchorsUnresolved` (warn, keep going).
- Child types must be allowed for the parent (`system`→`module|external`; `module`→`module|surface|flow`; `surface`→`flow|symbol`; `flow`→`symbol|module`; `symbol` none; `external`→`surface|flow`). `symbol` is always a leaf.

## User mark-detail (HP2)

The human marks a node in the map UI (or `map detail mark --slug <slug>`). You then `work next` → `kind=detail` on that slug → one-hop children + anchors → `complete`. They **Reload** the UI. Leaves (`symbol` / `leaf: true`) are opened by the UI from `anchors[]`; you do not open an editor.

## Pull / HEAD move (HP3)

1. `routine status --json` — if behind HEAD / needs refresh → `routine refresh`.
2. Drain **required routine steps** before remaining detail.
3. `routine advance` when status allows. Detail never gates `base`.

### Routine complete sketches

**structure_sync** — cover git diff; empty `ops` is OK if the graph already exists **and** every touched path is either anchored or listed in `coverage.unmappedPaths`.

```json
{
  "schemaVersion": 1,
  "base": "<epoch.base>",
  "target": "<epoch.target>",
  "ops": [],
  "coverage": { "touchedPathsConsidered": true, "unmappedPaths": ["docs/note.md"] }
}
```

**blast_radius** — empty `nodes` is legal when no anchors intersect the diff (⇒ **zero** `metric_decay` steps). Non-empty rows need `evidence`.

**metric_decay** — exactly one `updates[]` row matching the claimed `(nodeId, level)`. `value` must be `≤ min(storedPrevious, severityCap)`. Do not raise trust.

Use `work fail` only for routine kinds (`structure_sync` / `blast_radius` / `metric_decay`) when you cannot produce a valid payload.

## Mixed queue (HP4)

If both epoch steps and detail todos exist: finish required routine first; `routine advance` does not wait on detail.

## Out of scope

Learning, quiz, verify, hooks install, agent spawn, util filesystem watch, committing `.snowshoe` to the project remote.
