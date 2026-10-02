---
status: accepted
date: 2026-10-02
---

# ADR-2026-10-02: Map left-column nav tabs

## Status

Accepted. Amends [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md) and [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md). Does **not** ship learning/quiz/verify as product; `learn` / `quiz` remain personal mark kinds only.

## Context

The map left column was tree-only. Operators need a place for an ego / local graph later, and a list of nodes they personally flagged (`learn` / `quiz`) without scanning the whole tree.

## Decision

The left column is a **nav pane** with three tabs (tab choice in `sessionStorage` key `snowshoe.navTab`, default `tree`):

| Tab | Contents |
|---|---|
| **Tree** | Existing collapsible map tree (keyboard nav only while this tab is active). |
| **Graph** | Radial ego graph of the focused node (1-hop from the loaded read-model). Previous/next visit borders; History back/forward. [ADR-2026-10-02-map-local-graph](./ADR-2026-10-02-map-local-graph.md). |
| **Todos** | Flat list of nodes that carry at least one human todo mark (`learn` and/or `quiz`). Click selects the node (same selection / hash / inspector as the tree). Count badge when non-empty. |

Work mark kinds (`expand` / `enrich` / `fix`) stay out of the Todos tab — they remain inspector chips and `work next`. Do not call these tabs “tags.”

## Alternatives considered

- Overlay graph beside the tree — rejected; keeps the three-column split and one nav surface.
- Include work marks in Todos — rejected; those are agent queue, not human personal flags.
- Separate window for todos — rejected; stay inside the map UI.

## Consequences

CURRENT describes the left-column tabs. Graph is a radial ego view over the same `MapReadModel` ([ADR-2026-10-02-map-local-graph](./ADR-2026-10-02-map-local-graph.md)). Human todo list is read-model only (marks already on `map status`).

## Evidence

None beyond this change’s tests.
