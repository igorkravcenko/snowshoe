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
| `items` | This call’s new claims. May be nonempty while `leased` is also nonempty. |
| `leased` | Queue-visible live leftovers not minted this call (same tokens). Always present. The ledger has no lease owner: you tell **your own** from **foreign** ones (see Lease order). |
| `stop` | `true` when nothing is left for you after this batch: `leased` is empty and `remaining` is `0`. Gates and `idle` are always `true`. A hint; the loop below decides. |
| `remaining` | Claimable steps not taken into `items` this call (more work after this batch). `leased` rows are not counted. |
| `locale` | BCP-47 UI language from ledger meta (`en`, `en-US`, …), or `null` if unset. |

Terms:

- **Open epoch** — the routine catch-up range currently being synced (`base..target`). `routine refresh` replaces it; the old one becomes **superseded**.
- **Queue-visible** — map hops (`detail` / `expand` / `enrich` / `fix`) always, plus routine steps (`structure_sync` / `blast_radius` / `metric_decay`) of the open epoch only.
- **Live leftover** — a queue-visible step that is leased with an unexpired lease and was not minted by this call. These are what `leased` lists.
- **Interactive map drain** — the human asked you to keep draining as they mark nodes in the map UI (same session). Only then do you poll with `--wait` (see below).

Until `todo` is null, **run only that unlock command**, then call `work next` again. Do not look for other work, do not complete steps (including `leased`), do not skip the gate. Do **not** complete across refresh (routine completes reject `refresh_required` while the gate shows, `epoch_not_open` after it). Map hops are not epoch-scoped, so the CLI does not reject them during the refresh gate — holding them until `todo` is clear is your discipline.

```
# outer: re-fetch the batch every cycle
# nextCmd is `snowshoe work next --json` unless interactive wait (below)
loop:
  batch ← nextCmd
  if batch.todo is set:
    run batch.todo exactly
    continue                         # do not complete across refresh
  if batch.waitTimedOut: STOP and report
  mine    ← batch.items + (batch.leased whose leaseToken YOU got from an earlier work next in this context)
  foreign ← batch.leased − mine      # tokens you do not remember are foreign (incl. after compaction)
  if mine is nonempty:               # 1. own work first, any order you like
    for step in mine: complete(step)
    nextCmd ← snowshoe work next --json
    continue                         # foreign leased: leave them; re-poll
  if foreign is nonempty:            # 2. own work done and they are still there → take them now
    for step in foreign: complete(step)   # crashed / compacted worker; no waiting, no re-poll spin
    nextCmd ← snowshoe work next --json
    continue
  if interactive map drain:
    nextCmd ← snowshoe work next --json --wait
    continue
  STOP

complete(step):
  do the work for step.kind
  snowshoe work complete --json      # envelope on stdin or --input; id = step.stepId
  if result is skip-and-repoll: drop this step, go on with the rest
  if result is hard reject: STOP and report reasons
  if operator interrupt: STOP and report
```

### Lease order

The ledger has no lease owner. **Your** leased are the `leaseToken`s you received from an earlier `work next` in your own context. Anything else in `leased` is **foreign**.

1. Do your own work first: this call's `items` plus your own `leased`. The order between them is your choice.
2. While you still have own work, leave foreign `leased` alone — another live worker may be on them. Re-poll after your own work.
3. Once a poll gives you no own work (no `items`, none of your own `leased`), do not wait any longer: take the foreign `leased` from **that poll** now (the other worker probably crashed or lost context). Do not wait or re-poll in a loop for them. If the original worker was alive after all, whichever of you completes second gets `already_closed` and skips.
4. Lost context (compaction) and you do not remember your tokens: treat every `leased` as foreign. Rule 3 still makes you finish them once your own `items` are done.

### Rejects: skip vs STOP

`work complete` returns per-step `results[]` with `status` and `reasons`.

- **Skip-and-repoll** (not an error; drop that step and continue): `already_closed` (someone finished it), `lease_reclaimed` (the step is still leased under another token — probably your lease expired and another worker re-claimed it; a wrong UUID-shaped token also lands here, which is harmless; the next poll lists the step in `leased` with its current token — if that is a token you hold (you sent a typo), it is still yours; otherwise it is foreign; follow Lease order), `epoch_not_open` (token from before `routine refresh`), `refresh_required` (HEAD moved; the next `work next` shows the refresh `todo`), `lease_expired` (lease timed out and went back to the queue — the next `work next` re-mints it).
- **Hard reject → STOP and report:** every other reason — `unknown_step`, `kind_mismatch`, `bad_lease` (token does not match: malformed, or the step is no longer leased — e.g. an old token on a step that was reset or re-marked since; STOP is the conservative choice), `unknown_kind`, `invalid_payload: …`, and the kind-specific payload rejects (`missing_body:…`, `anchor_missing:…`, `matrix_forbid:…`, `coverage_unmapped:…`, `epoch_base_target_mismatch`, `value_exceeds_cap:…`, …; full lists per kind — map hops, `structure_sync`, `blast_radius`, `metric_decay` — in `snowshoe work complete --help --json`).

### Exit codes

- `0` — success, including gates (`init` / `refresh` / `advance`) and `idle`.
- `1` — `work complete` with at least one rejected step (`ok: false`; read `results[].reasons`).
- `2` — usage: non-JSON input, invalid envelope, invalid flag values (e.g. `--batch-size x`). Unknown flags are ignored, not rejected.

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
snowshoe init --json --locale en
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
snowshoe map mark --json --slug <slug> --kind detail
snowshoe map mark --json --slug <slug> --kind expand
snowshoe map mark --json --slug <slug> --kind enrich
snowshoe map mark --json --slug <slug> --kind fix
snowshoe map detail mark --json --slug <slug>
snowshoe map detail cancel --json --slug <slug>
snowshoe help --json
```

Use `init`, `routine refresh`, and `routine advance` when `work next` puts them in `todo` — not as a competing entry path. `snowshoe help --json` is the command index.

`map mark` / `map detail mark` / `cancel`: only if **this turn** the human asked to mark, detail, expand, enrich, fix, or cancel those nodes. Do not crawl unmarked nodes. Then `work next` as usual.

Work mark kinds (each queues **its own** step):

| Kind | Meaning |
|---|---|
| `detail` | Grow children **and/or** rewrite this node’s fields/body (agent discretion). Prefer when the human intent is ambiguous. |
| `expand` | Grow / fill children under the node only. |
| `enrich` | Improve **this** node’s fields — especially the markdown `body`. No new children. |
| `fix` | Something looks wrong here; inspect and repair structure and/or fields. May add children (same `allowedChildTypes` and split rule as expand). |

`learn` and `quiz` are personal Later flags (not `work next`). System inbox marks `new` / `decayed` are stamped by the ledger (create / metric drop); do not set them yourself.

When `todo` is `snowshoe init --json`, you may add `--locale <tag>` (alias `--ui-language`) with a BCP-47 tag such as `en` or `en-US`. Init is idempotent: the same command on an existing ledger sets or updates locale meta.

## Locale

Bodies are written in the user's language. Read `locale` from `init`, `work next`, or `map status` JSON.

If locale is missing when you start a map hop that writes bodies: deduce it from the conversation or ask the user once, then persist with `snowshoe init --json --locale <tag>` **before** writing bodies. Do not default to English unless locale is `en`.

## Body shape

Entity markdown is human-readable. Prefer:

1. **First paragraph** — overview (what this node is / does). Agents may read only this via `map status --fields …,bodyOverview`.
2. **Blank line**, then structured detail (headings, lists, gotchas).

Avoid one-line telegram bodies. Domain jargon in prose only as wiki links `[[slug]]` or `[[slug|label]]` pointing at a map node that defines the term. If nowhere fits, create/use a `glossary` child under `root` on a hop that allows children (`detail` / `expand` / `fix`). Broken `[[…]]` in the UI means fix or enrich — do not leave silent jargon.

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

Same payload shape as expand. Agent may grow children **and/or** upsert `parentSlug` body/fields. Prefer this when the human asked to “detail” or intent is unclear. Honor `allowedChildTypes` when adding children. Adding children counts as a split: a parent upsert without `leaf` clears its stop-flag (send `leaf: true` to keep it).

### `kind=expand`

One hop under `parentSlug` from the claimed item. Honor `allowedChildTypes` on that item. The claimed item includes `children` (current parent→child slugs). Prefer that over a full `map status`. If you need more: `map status --json --slug <parent>` (that node only; add `--depth N` for a subtree) or `--neighborhood --slug <node>` (parents, children, refs, `edges`). `--depth` without `--slug` is a subtree from `root`. Do not combine `--depth` with `--neighborhood`. Default columns are `slug` and `children`. `--fields` is a comma-separated allowlist (`bodyOverview` for lead paragraphs; e.g. `--fields title,type,leaf,children,refs`). `--all-fields` is every column (bodies, anchors). Do not combine `--all-fields` with `--fields`. When scanning many nodes, prefer `bodyOverview` over full `bodyMd`.

**Decide the hop before writing.** Expand means “look at this parent,” not “must mint children.”

1. **No growth** — dead end, already correct, or exploratory: `unchanged: true` with empty `nodes` / `children` / `refs` / `retire` / `clearEdges`. That is a successful complete. Non-empty mutate with `unchanged` rejects (`unchanged_with_mutate`).
2. **Grow or fill** — as many new children as the **cut** needs (a surface can be a long list); not a tour of the repo. The map is a mental model, not 1:1 with code. If the honest list would be huge, add an **intermediate grouping** layer (responsibility / feature), not dozens of siblings. If some children matter more, put those on this hop and leave the rest for a later expand mark. Same axis as an existing sibling → **ref** that slug; do not invent a clone (`cli-work` vs `work`). `leaf: true` when the next hop would only be code (`anchors[]`). `symbol` may have `symbol` children (class → methods). Mark expand on a `leaf` parent means split further: honor `allowedChildTypes` from `work next` (that hop ignores the stop-flag). If you add children and upsert the parent without `leaf`, the parent’s stop-flag clears; send `leaf: true` only if it should stay a leaf.

You may **upsert `parentSlug`** in `nodes[]` to enrich the marked node (title, type, `leaf`, body, anchors). Do not put it in `children[]`. You cannot upsert `root`. You cannot reparent (move a node under a different parent).

- `children`: parent→child slugs under `parentSlug`. Every `nodes[].slug` except `parentSlug` must appear here.
- `refs`: relevance links (not hierarchy). Optional `kind` (default `related`). Not `parent`.
- `retire`: delete descendant slugs (not `parentSlug`, not `root`). Cascade edges/anchors/metrics.
- `clearEdges`: `{ from, to, kind? }`. `kind` default `related`. `parent` only `from=parentSlug` and `to` a current child (unlink). Ref clears: at least one end in the parent subtree.
- `body` (markdown string, alias `bodyMd`): **required** on each upserted node when `unchanged` is false. Write it in the init locale in a human readable form (overview paragraph, then detail). The CLI writes `.snowshoe/map/nodes/<slug>.md` and sets `proseRef`. You may write that file yourself and send `proseRef` instead; empty or missing prose rejects (`missing_body:<slug>`).

```json
{
  "schemaVersion": 1,
  "completions": [
    {
      "id": "<stepId>",
      "leaseToken": "<leaseToken>",
      "kind": "expand",
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
                "endLine": 80,
                "locatorOffset": 0
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
- Each anchor is `{ path, symbol?, startLine?, endLine?, locatorOffset }`. `path` is required (repo-relative). **`locatorOffset` is required** (int ≥ 0): lines from `startLine` down to the identity / declaration line whose text the ledger stores for rebase. Use `0` when `startLine` is already that line. Example: fragment starts at a decorator and the class is next → `startLine` on the decorator, `locatorOffset: 1`. `startLine` / `endLine` are **1-based, inclusive**. `endLine` is optional: send it only when the end is known; omit rather than guess. The ledger stores fragment size from that span. `symbol` is an optional label, not a substitute for lines.
- The map UI loads the **whole file**, scrolls to `startLine` (if set), and highlights `startLine…endLine` or just `startLine`. Prefer a real span (function, section) over always `startLine: 1`.
- Follow `allowedChildTypes` from `work next`. `leaf: true` nodes are a stop-flag; humans still open `anchors[]`. A later expand mark on that node is a request to cut children.

### `kind=enrich`

Same complete envelope family as expand, but **only** upsert `parentSlug` (title, type, `leaf`, `body` / anchors). Keep `children` / `refs` / `retire` / `clearEdges` empty. Rejects `enrich_forbids_*` / `enrich_only_parent` / `enrich_requires_parent_upsert` if you grow the graph. Prefer rewriting the markdown body in the init locale (overview + detail; wiki links for jargon).

If you substantially change what the node *means* (not a typo / wording polish), consider lowering comprehension metrics via the metric_decay hop or by asking the human — only when their understanding of this node likely dropped. Do not always decay. The map UI stamps system inbox marks (`new` on create, `decayed` on metric drops); do not invent those marks yourself.

### `kind=fix`

Same payload shape as expand. Intent: the marked area is wrong or stale — re-read code/anchors, then repair children, refs, body, or retire bad nodes. Honor `allowedChildTypes` when adding children. Adding children counts as a split: a parent upsert without `leaf` clears its stop-flag (send `leaf: true` to keep it). Prefer a real fix over `unchanged: true` unless you confirmed nothing is broken.

### Routine kinds

`work next` orders routine steps before map hops. Routine items expose `base` and `target`. `base` is the pinned caught-up commit (epoch start). `target` is the commit this epoch syncs toward. Echo `base` / `target` / `nodeId` / `level` / `blastSeverity` from the item.

The diff for these steps is `git diff --name-only <base>..<target>` (commits in that range only). Do not use the working tree, unstaged changes, or only the latest commit.

**structure_sync** — cover that pinned range. Empty `ops` is OK when every path in `base..target` is already anchored or listed in `coverage.unmappedPaths`. On `upsert_node`, present `codeAnchors` replaces ALL anchors for that slug (omit the field to keep existing); omit `leaf` on an existing node keeps the stored flag (new node omit → `false`; send an explicit boolean to change it). Payloads: `snowshoe work complete --help --json`.

```json
{
  "schemaVersion": 1,
  "base": "<epoch.base>",
  "target": "<epoch.target>",
  "ops": [],
  "coverage": { "touchedPathsConsidered": true, "unmappedPaths": ["docs/note.md"] }
}
```

**blast_radius** — empty `nodes` is legal when nothing in `base..target` hits anchors. Non-empty rows need `evidence`. Caps and reject codes: `work complete --help --json`.

**metric_decay** — exactly one `updates[]` row matching the claimed `(nodeId, level)`. Do not raise the stored value. Caps and reject codes: `work complete --help --json`.

## Map UI

**Mark** is the work queue (`detail` / `expand` / `enrich` / `fix`), not node color. The human marks in the map UI, or **this turn** asks you to `map mark` / `map detail mark` / `cancel`. Do not walk the tree marking nodes. You complete claimed steps through the CLI.

**Green** is the UI `solid` band when a metric float is ≥ 0.75 (`overview` / `contracts` / `internals`). Inspector pills are read-only. Writes go through `snowshoe map metric --json` (see `learn.md`). Drain `work complete` omits metric fields; new nodes seed at 0. `metric_decay` only lowers. Do not say only the human paints green.

They reload the map. Reload in the UI lights up when the ledger moved (`work complete`, CLI mark, another tab); they still click Reload. They read entity bodies, follow `refs`, and preview code from anchors (whole file, scroll to `startLine`, highlight the line or `startLine`–`endLine`; `vscode://` is secondary).

```bash
snowshoe map status --json
```

## Stop

- `work next` returns no `todo`, empty `items`, and empty `leased` (`action: idle`) and you are **not** in interactive `--wait` mode
- `waitTimedOut: true`
- hard reject on complete (see *Rejects: skip vs STOP*; skip-and-repoll codes are not a STOP)
- operator interrupt or budget exhausted
