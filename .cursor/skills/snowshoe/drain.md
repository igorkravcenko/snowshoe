# Snowshoe drain

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
| `locale` | BCP-47 UI language from ledger meta (`ru`, `en`, …), or `null` if unset. |

Until `todo` is null, **run only that unlock command**, then call `work next` again. Do not look for other work, do not complete steps, do not skip the gate.

```
# outer: re-fetch the batch every cycle
# nextCmd is `snowshoe work next --json` unless interactive wait (below)
loop:
  batch ← nextCmd
  if batch.todo is set:
    run batch.todo exactly
    continue                         # do not assume the queue is empty
  if batch.waitTimedOut: STOP and report
  if batch.items is empty:           # action is idle (or work with nothing claimable)
    if interactive map drain:
      nextCmd ← snowshoe work next --json --wait
      continue
    STOP
  # inner: current batch
  for step in batch.items:
    do the work for step.kind
    snowshoe work complete --json    # envelope on stdin or --input
    if result is hard reject: STOP and report reasons
    if operator interrupt: STOP and report
  nextCmd ← snowshoe work next --json
  # next outer cycle — refresh the batch; finishing these tickets ≠ queue empty
```

`--batch-size` is optional; the CLI default is already a small batch.

### Interactive `--wait`

Use `--wait` **only** when the human asked to keep draining the map as they mark nodes (same session, map UI open). Do not use it for a one-shot catch-up after pull. At most **one** `--wait` loop in the session — do not start a second waiter.

```bash
snowshoe work next --json --wait
```

`--wait` blocks only while `action` would be `idle` (wakes on `.snowshoe/` file events; 2s fallback). Gates (`init` / `refresh` / `advance`) and claimable `work` return immediately. Optional `--wait-timeout <ms>` (`0` = forever). Timeout JSON is still `action: idle` plus `waitTimedOut: true` — treat as STOP.

`work complete` reads JSON from **stdin** (or `--input '<json>'`).

## Commands

```bash
snowshoe work next --json
snowshoe work next --json --wait
snowshoe init --json --locale ru
snowshoe routine refresh --json
snowshoe routine status --json
snowshoe routine advance --json
snowshoe work complete --json
snowshoe map status --json
snowshoe map status --json --slug <parent>
snowshoe map status --json --depth 1
snowshoe map status --json --neighborhood --slug <node>
snowshoe map status --json --all-fields
snowshoe map status --json --fields title,type,leaf,children,refs --slug <parent>
```

Use `init`, `routine refresh`, and `routine advance` when `work next` puts them in `todo` — not as a competing entry path.

When `todo` is `snowshoe init --json`, you may add `--locale <tag>` (alias `--ui-language`) with a BCP-47 tag such as `ru` or `en`. Init is idempotent: the same command on an existing ledger sets or updates locale meta.

## Locale

Bodies are written in the user's language. Read `locale` from `init`, `work next`, or `map status` JSON.

If locale is missing when you start a `kind=detail` step: deduce it from the conversation or ask the user once, then persist with `snowshoe init --json --locale <tag>` **before** writing bodies. Do not default to English unless locale is `en`.

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

One hop under `parentSlug` from the claimed item. Honor `allowedChildTypes` on that item. The claimed item includes `children` (current parent→child slugs). Prefer that over a full `map status`. If you need more: `map status --json --slug <parent>` (that node only; add `--depth N` for a subtree) or `--neighborhood --slug <node>` (parents, children, refs, `edges`). `--depth` without `--slug` is a subtree from `root`. Do not combine `--depth` with `--neighborhood`. Default columns are `slug` and `children`. `--fields` is a comma-separated allowlist. `--all-fields` is every column (bodies, anchors). Do not combine `--all-fields` with `--fields`.

**Decide the hop before writing.** Mark means “look at this parent,” not “must mint children.”

1. **No growth** — dead end, already correct, or exploratory: `unchanged: true` with empty `nodes` / `children` / `refs` / `retire` / `clearEdges`. That is a successful complete. Non-empty mutate with `unchanged` rejects (`unchanged_with_mutate`).
2. **Grow or fix** — as many new children as the **cut** needs (a surface can be a long list); not a tour of the repo. Same axis as an existing sibling → **ref** that slug; do not invent a clone (`cli-work` vs `work`). `leaf: true` when the next hop would only be code (`anchors[]`). `symbol` is always a leaf.

You may **upsert `parentSlug`** in `nodes[]` to enrich the marked node (title, type, `leaf`, body, anchors). Do not put it in `children[]`. You cannot upsert `root`. You cannot reparent (move a node under a different parent).

- `children`: parent→child slugs under `parentSlug`. Every `nodes[].slug` except `parentSlug` must appear here.
- `refs`: relevance links (not hierarchy). Optional `kind` (default `related`). Not `parent`.
- `retire`: delete descendant slugs (not `parentSlug`, not `root`). Cascade edges/anchors/metrics.
- `clearEdges`: `{ from, to, kind? }`. `kind` default `related`. `parent` only `from=parentSlug` and `to` a current child (unlink). Ref clears: at least one end in the parent subtree.
- `body` (markdown string, alias `bodyMd`): **required** on each upserted node when `unchanged` is false. Write it in the init locale in a human readable form. The CLI writes `.snowshoe/map/nodes/<slug>.md` and sets `proseRef`. You may write that file yourself and send `proseRef` instead; empty or missing prose rejects (`missing_body:<slug>`).

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
            "body": "<markdown in the init locale>",
            "anchors": [
              {
                "path": "src/cli.ts",
                "symbol": "main",
                "startLine": 45,
                "endLine": 80
              }
            ]
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
- Each anchor is `{ path, symbol?, startLine?, endLine? }`. `path` is required (repo-relative). `startLine` / `endLine` are **1-based, inclusive**. `endLine` is optional: omit it to mark a single line; set both to mark a contiguous slice (`endLine >= startLine`). `symbol` is an optional label, not a substitute for lines.
- The map UI loads the **whole file**, scrolls to `startLine` (if set), and highlights `startLine…endLine` or just `startLine`. Prefer a real span (function, section) over always `startLine: 1`.
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

The human marks a node, cancels a pending mark, and reloads the map. Reload in the UI lights up when the ledger moved (`work complete`, CLI mark, another tab); they still click Reload. They read entity bodies, follow `refs`, and preview code from anchors (whole file, scroll to `startLine`, highlight the line or `startLine`–`endLine`; `vscode://` is secondary). You complete work through the CLI.

```bash
snowshoe map status --json
```

## Stop

- `work next` returns empty `items` and no `todo` (`action: idle`) and you are **not** in interactive `--wait` mode
- `waitTimedOut: true`
- hard reject on complete (bad lease, invalid payload, missing anchors, …)
- operator interrupt or budget exhausted
