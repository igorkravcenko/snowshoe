---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Detail payload `children` + `refs`; hard-reject unresolved anchors

## Status

Accepted. Amends the agent-facing detail complete contract used by [ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) and [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md). Does **not** promote proposed routine ADRs A/B.

## Context

Day-1 detail complete mashed parent→child structure and any other links into one `edges` list (`kind: parent`). Missing or moved anchor files were **accepted** with `anchorsUnresolved` (warn, keep going). Igor: split hierarchy from relevance; **reject** `work complete` until missing/moved anchors are fixed (decision A). The skill must not teach `anchorsUnresolved` or forbidden payload bits (util validates silently).

## Decision

### Two lists, not `edges`

Inner `kind=detail` payload:

- **`children`**: parent→child slugs under `parentSlug`. Every `nodes[].slug` except `parentSlug` must appear. Util writes hierarchy edges (`kind=parent`).
- **`refs`**: non-hierarchy relevance links `{ from, to, kind? }` (default `kind` `related`). `kind` must not be `parent`.
- **`parentSlug` in `nodes[]`**: enrich the marked node (title, type, `leaf`, body, anchors). Not reparent. `root` cannot be upserted.
- **`retire`**: delete descendant slugs (not `parentSlug`, not `root`); cascade like ledger delete.
- **`clearEdges`**: remove an edge. `kind` default `related`. `parent` only from `parentSlug` to a current child.

`unchanged: true` with any of `nodes` / `children` / `refs` / `retire` / `clearEdges` non-empty **rejects**.

Do not send a single `edges` list. If `edges` is present, **hard-reject** with a deprecation reason pointing at `children` and `refs`.

Map read-model keeps `children: string[]` and may include outgoing `refs`.

### Anchors

Missing or moved anchor `path`s (non-glob) **reject** the completion. The graph is not written. No soft `anchorsUnresolved` on accept. Map read-model may still surface unresolved flags on legacy rows.

Forbidden node types and similar constraints stay util-side; the skill does not document them.

## Alternatives considered

- Keep `edges` with mixed `kind` — rejected; hierarchy vs relevance must not be mashed.
- Accept + warn on missing anchors — rejected (Igor A).
- Soft-accept `edges` forever — rejected; hard deprecation message is enough.

## Consequences

- CURRENT: detail complete uses `children` + `refs`; optional enrich/`retire`/`clearEdges` in the parent subtree; unresolved anchors reject.
- Zod, `detail-complete.schema.json`, complete handlers, skill examples, and tests match this contract.
- Notes that still say `edges` / soft `anchorsUnresolved` are historical working memory, not truth.

## Evidence

- [../notes/detail-queue-and-map.md](../notes/detail-queue-and-map.md) (historical `edges` / soft-anchor text)
- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)

