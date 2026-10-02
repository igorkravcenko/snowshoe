---
status: accepted
date: 2026-10-02
---

# ADR-2026-10-02: Map local graph (radial ego)

## Status

Accepted. Amends [ADR-2026-10-02-map-nav-tabs](./ADR-2026-10-02-map-nav-tabs.md) (Graph tab was a stub) and [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md). Does **not** ship learning/quiz/verify.

## Context

The left-column Graph tab needed navigable local (ego) graph UX inspired by Obsidian’s local graph, without a second in-memory map model or extra HTTP.

## Decision

1. **One SoT in the UI** — the existing `MapReadModel` from `GET /api/map/status?allFields=1`. Tree and Graph are two views. Ego cut is a pure client derivation (`buildEgoGraph`) over the same node index (`children`, parent links, `refs` / incoming refs). Do **not** store a parallel `graphModel` or call `--neighborhood` for the UI.

2. **Radial ego layout** — focused slug at center; 1-hop neighbors on a ring; no force simulation in this slice.

3. **Edge kinds** — stroke/arrow families: `parent` (solid, directed parent→child) vs other ref kinds (dashed). Unknown kinds use the ref family. Small in-pane legend. No edge text labels.

4. **Visit history** — one stack: browser History (URL hash + `pushState` / `popstate`), same as tree/breadcrumb Back/Forward. A React mirror exposes previous/next slugs for chrome. Neighbor (and other non-history) clicks `pushState`. Clicking the **previous** node calls `history.back()`; **next** calls `history.forward()` — so A→B→back to A does not append A-B-A.

5. **Prev/next chrome** — compact **↺ / ↻ badges** at the top-left of the visit previous/next disks (not colored borders). Layout: previous always **left** of focus, next **right** (on-ring when a neighbor; otherwise bottom-left / bottom-right orphans). Free ring neighbors **reflow evenly** on the upper/lower arcs around those pins (not yanked after a uniform circle). Node tips use a fast in-pane tooltip (~40ms), not native SVG `<title>`. Right-click a node for a context menu of all mark kinds (same set as the inspector Mark control).

## Alternatives considered

- Force-directed layout — deferred; radial is enough for 1-hop in a narrow column.
- Separate visit stack beside History — rejected; would diverge from browser Back/Forward.
- Fetch `map status --neighborhood` per focus — rejected; data already in the loaded read-model.
- Second graph object as SoT — rejected; duplicates nodes/edges and drifts on Reload/mark.
- Color-coded prev/next borders — rejected; unreadable on metric bullseyes.
- Undo/redo toolbar buttons — rejected; history mark belongs on the nodes.

## Consequences

CURRENT and the Graph tab describe a working radial ego graph. Nav-tabs ADR Graph row is no longer a stub. Multi-hop, pan/zoom, physics, and edge labels remain out of scope.
## Evidence

None beyond this change’s tests.
