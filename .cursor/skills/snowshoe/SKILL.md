---
name: snowshoe
description: >-
  Drive the Snowshoe CLI drain loop: work next as entry, follow its todo
  (init / routine refresh / routine advance), complete claimed steps, then
  call work next again. Use after pull or when catching up a personal repo map.
---

# Snowshoe drain skill

Assume **`snowshoe` is on PATH**. Always pass `--json` and parse the result.

If `snowshoe` is missing (`command -v snowshoe` fails), **stop the drain** and open **`install.md` in this same folder** — only then. Do not load install instructions into a normal drain.

The install binary is **`snowshoe`**. A user-local shell alias such as `snoe` is optional convenience.

Drive the CLI. Do not write the ledger yourself.

## Entry: `work next`

Every drain starts with:

```bash
snowshoe work next --json
```

`work next` is the gate. Follow **one** field shape:

| Field | Meaning |
|---|---|
| `action` | `init` · `refresh` · `advance` · `work` · `idle` |
| `todo` | Exact command to run when gated (`init` / `refresh` / `advance`). `null` otherwise. |
| `items` | Claimed steps. Empty unless `action` is `work` and there is claimable work. |

Until `todo` is null, **run only that unlock command**, then call `work next` again. Do not look for other work, do not complete steps, do not skip the gate.

```
# outer: re-fetch the batch every cycle
loop:
  batch ← snowshoe work next --json
  if batch.todo is set:
    run batch.todo exactly
    continue                         # do not assume the queue is empty
  if batch.items is empty:           # action is idle (or work with nothing claimable)
    STOP
  # inner: current batch
  for step in batch.items:
    do the work for step.kind
    snowshoe work complete --json    # envelope on stdin or --input
    if result is hard reject: STOP and report reasons
    if operator interrupt: STOP and report
  # next outer cycle — refresh the batch; finishing these tickets ≠ queue empty
```

`--batch-size` is optional; the CLI default is already a small batch.

`work complete` reads JSON from **stdin** (or `--input '<json>'`).

## Commands

```bash
snowshoe work next --json
snowshoe init --json
snowshoe routine refresh --json
snowshoe routine status --json
snowshoe routine advance --json
snowshoe work complete --json
snowshoe map status --json
```

Use `init`, `routine refresh`, and `routine advance` when `work next` puts them in `todo` — not as a competing entry path.

## Completing a step

Envelope:

```json
{
  "schemaVersion": 1,
  "completions": [
    {
      "id": "<stepId from work next>",
      "leaseToken": "<leaseToken from work next>",
      "kind": "<step.kind>",
      "payload": {}
    }
  ]
}
```

`kind` must match the claimed step. Payload shape depends on `kind`. `snowshoe work complete --help` and the examples below are the contract; omit metric fields (the CLI sets them).

### `kind=detail`

One hop under `parentSlug` from the claimed item. Honor `allowedChildTypes` on that item.

- `children`: parent→child slugs under `parentSlug`. Every `nodes[].slug` must appear here.
- `refs`: relevance links between entities (not hierarchy). Optional `kind` (default `related`). Do not use parent/child structure here.

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
        "children": ["cli"],
        "refs": []
      }
    }
  ]
}
```

- `unchanged: true` with empty `nodes` / `children` / `refs` clears the todo without growing the graph.
- `proseRef`, if used, must stay under `.snowshoe/map/`.
- Anchor `path`s must exist in the repo (missing or moved paths reject the complete).
- Follow `allowedChildTypes` from `work next`. Leaves (`symbol` or `leaf: true`) are opened by the human from `anchors[]`.

### Routine kinds

`work next` orders routine steps before detail. Routine items expose `base` and `target`. `base` is the pinned caught-up commit (epoch start). `target` is the commit this epoch syncs toward. Echo `base` / `target` / `nodeId` / `level` / `blastSeverity` from the item.

The diff for these steps is `git diff --name-only <base>..<target>` (commits in that range only). Do not use the working tree, unstaged changes, or only the latest commit.

**structure_sync** — cover that pinned range. Empty `ops` is OK when every path in `base..target` is already anchored or listed in `coverage.unmappedPaths`.

```json
{
  "schemaVersion": 1,
  "base": "<epoch.base>",
  "target": "<epoch.target>",
  "ops": [],
  "coverage": { "touchedPathsConsidered": true, "unmappedPaths": ["docs/note.md"] }
}
```

**blast_radius** — empty `nodes` is legal when nothing in `base..target` hits anchors. Non-empty rows need `evidence`.

**metric_decay** — exactly one `updates[]` row matching the claimed `(nodeId, level)`. Do not raise the stored value.

## Map UI

The human marks a node, cancels a pending mark, and reloads the map. You complete work through the CLI. After `work complete`, they reload to see the tree.

Do not start `map serve` unless the human asked.

```bash
snowshoe map status --json
```

## Stop

- `work next` returns empty `items` and no `todo` (`action: idle`)
- hard reject on complete (bad lease, invalid payload, missing anchors, …)
- operator interrupt or budget exhausted
