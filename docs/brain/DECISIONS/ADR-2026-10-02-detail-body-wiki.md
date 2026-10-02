---
status: accepted
date: 2026-10-02
---

# ADR-2026-10-02: Detail hop union, body overview, wiki links

## Status

Accepted. Amends [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md), [ADR-2026-09-27-locale-body-preview](./ADR-2026-09-27-locale-body-preview.md), [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md), and [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Does **not** auto-materialize `refs` from wiki links. Does **not** add learning/quiz/verify.

## Context

Operators marking “detail” expected the agent to rewrite prose and/or grow children; after polish, `detail` aliased `expand`, so agents often minted children instead of human-readable bodies. Bodies were one-line telegrams. Domain jargon had no in-map link convention.

## Decision

### Work kind `detail`

- `detail` is a real work mark / map hop again (not an alias of `expand`).
- Complete allows the same graph mutations as expand/fix **and** parent body/field upserts (union of expand + enrich). Enrich stays strict (`enrich_forbids_*`).
- `map detail mark` and HTTP default mark kind queue `detail`. Narrow `expand` / `enrich` / `fix` remain.
- `work next` exposes `allowedChildTypes` for `detail` like expand (leaf stop-flag ignored on that hop).
- Complete envelopes may still send `kind: "detail"` for legacy `expand` steps (one-way match); new detail steps use `kind: "detail"`.

### Body shape + `bodyOverview`

- Entity markdown SoT stays one prose file. Convention: **first paragraph = overview**, then blank line / headings for structured detail.
- Map status gains derived field `bodyOverview` (first non-empty paragraph; stop at blank line or ATX heading). `bodyMd` remains full text. No second ledger column.
- Agents scanning many nodes prefer `--fields …,bodyOverview`.

### Wiki links (UI-only)

- Bodies may use Obsidian-style `[[slug]]` / `[[slug|label]]`.
- Map inspector renders them as clickable navigation (same as refs go-to). Missing slugs get a distinct broken style. No util extraction into `refs`.
- Skill convention: jargon only via wiki links to defining nodes; if nowhere fits, upsert under `glossary` child of `root` on a hop that allows children.

## Alternatives considered

- Keep `detail` as expand alias; teach enrich only — rejected; humans still press Detail for “fix this node.”
- Store overview as a separate ledger field — rejected; drift risk.
- Auto-create `refs` from `[[…]]` — deferred; graph noise.
- Hard util lint for unlinked jargon — rejected; needs a dictionary.

## Consequences

- CURRENT / drain / help / UI Mark menu list `detail` as grow-and/or-rewrite.
- Polish ADR’s “detail → expand alias” claim is superseded for the mark/hop meaning (historical note may remain in that file’s status line).
- Tests cover detail complete with children+body, enrich still forbids children, `bodyOverview` slicing, wiki happy/missing render.

## Evidence

None required beyond this product decision.
