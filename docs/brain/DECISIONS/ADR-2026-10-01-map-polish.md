---
status: accepted
date: 2026-10-01
---

# ADR-2026-10-01: Map polish — leaf, mark kinds, anchors, layout

## Status

Accepted. Amends [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md) and [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Does **not** ship learning/quiz/verify as product. Learn/quiz **mark kinds** are personal flags only (not `work next`).

## Context

The tryable map UI shipped a wide default sidebar, wrap in the tree, `symbol` as an always-leaf type, guessed `endLine`, and a single Mark detail / Cancel pending pair. Operators needed a stop-flag that is not a type, durable start-line anchors after edits, and several **mark kinds** without calling them tags (real tags may appear later).

## Decision

### Layout

Default column weights are `{ tree: 32, detail: 40, sidebar: 28 }`. Tab storage key is `snowshoe.split.v2` so old wide splits do not restore. Sidebar stays a column (not overlay, not closed by default). Tree titles are a single nowrap row; the tree column scrolls horizontally.

### Leaf vs type

`leaf` is a stop-flag (“do not cut further yet”), not a synonym of type. `symbol` may have `symbol` children (class → methods). `allowedChildTypes` is empty only when `leaf` is true. Inspector leaf toggle remains. Mark **detail** on a leaf means split further: the claimed hop ignores `leaf` when computing `allowedChildTypes`. Agents set `leaf: true` when the next hop would only be code.

### Anchors

Agents may send `endLine` only when the end is known; omit it rather than guess. The ledger stores fragment **size** (`endLine - startLine + 1`) and the trimmed **line text** of the start line (not shown in the inspector). Preview open rebases: exact trim matches, closest to stored `startLine`; if none, keep the old start. If size is stored, `endLine' = startLine' + size - 1`. Missing path still rejects complete. Not LSP.

### Mark kinds

Name: **mark** / **mark kind**. Do not call these tags in API, ADR, or UI. Kinds: `detail`, `enrich`, `fix`, `learn`, `quiz`. UI: one **Mark** control, chip strip (newest first, no duplicates, dismiss). Work kinds `detail` / `enrich` / `fix` share **one** pending `kind=detail` step per slug. Learn and quiz never enter `work next`. `map detail mark|cancel` remain aliases; `map mark` / `unmark` / `leaf` are the general CLI. HTTP twins: `POST /api/map/mark|unmark|leaf`. Completing the detail step clears work kinds on that slug.

### Inspector

**Children** list sits under **Refs**; click navigates like refs. Empty children get a short hint.

### Drain cut

The map is a mental model, not 1:1 with code. Many children → consider an intermediate grouping layer when it carries meaning. Unequal children → put the important ones on this hop; the rest after another mark detail. No child-count quota.

## Alternatives considered

- Overlay / closed-by-default sidebar — rejected; narrower default split.
- Always-leaf `symbol` — rejected; classes need methods.
- Guessed `endLine` — rejected; omit if unknown.
- Calling chips “tags” — rejected; reserved for future node tags.

## Consequences

CURRENT and drain.md describe leaf-as-flag, mark kinds, grouping, and durable anchors. Map UI inspector and CLI match that contract.

## Evidence

None beyond this change’s tests.
