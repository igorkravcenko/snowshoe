---
status: accepted
date: 2026-10-20
---

# ADR-2026-10-20: omit `leaf` on upsert keeps the stored flag

## Status

Accepted. Amends leaf semantics in [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md). Same rule for `structure_sync` `upsert_node` and map hops (`detail` / `expand` / `enrich` / `fix`).

## Context

`leaf` is a stop-flag, not a type. On upsert, omit `codeAnchors` / `title` keeps the stored value; omit `leaf` was `Boolean(undefined)` → `false` and wiped `leaf: true` when the agent only meant to add a path. Help documented that trap. Agents still missed it.

## Decision

On upsert:

- Omit `leaf` on an **existing** node: keep the stored flag (same keep-on-omit as `title` and omit `codeAnchors`).
- Explicit `true` / `false`: set that value (`false` clears the stop-flag).
- **New** node, omit `leaf`: store `false`.
- **Split exception:** an `expand`, `detail`, or `fix` hop (any hop that may grow children; `enrich` cannot) that adds new children under `parentSlug` and upserts the parent **without** `leaf` stores `false` on the parent. Expand / detail / fix on a leaf means “split further” ([ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md)), and those hops get the same `allowedChildTypes` (stop-flag ignored); keeping `leaf: true` on a node that just gained children is contradictory. Explicit `leaf: true` on that upsert still wins. A hop that does not upsert the parent leaves the stored flag unchanged.

Help and `drain.md` state the existing-vs-new rule. A new-slug example that omits `leaf` still stores `false`; do not describe that example as keep.

## Alternatives considered

- Keep documenting omit → `false` and require agents to always send `leaf` — rejected; opposite omit semantics on the same payload.
- Treat omit as keep even on a new node — rejected; default remains “not a leaf”.

## Consequences

- CURRENT: omit `leaf` on an existing upsert keeps the stored stop-flag, except the parent of an expand / detail / fix hop that adds children (cleared).
- `work complete --help` and `drain.md` match the rule.

## Evidence

- GitHub [#37](https://github.com/igorkravcenko/snowshoe/issues/37)
