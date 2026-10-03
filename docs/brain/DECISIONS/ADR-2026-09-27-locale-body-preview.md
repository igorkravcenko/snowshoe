---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Locale at init, required entity body, in-UI code preview

## Status

Accepted. Amends init / detail complete / map read-model / map UI from [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md) and [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Does **not** promote proposed routine ADRs A/B. Does **not** add learning. 2026-10-02: selecting a node with `anchors[]` sets Code preview to the first (or current, if still on the node). That does **not** steal the sidebar tab; clicking an anchor still opens the Code tab.

## Context

After detail, the map inspector showed metrics and anchors but not human-readable entity prose. Anchor clicks were `vscode://` only; the in-UI Code preview from PR #11 (`GET /api/file`) was missing on current `ui/src/App.tsx` after later merges. Product owner: show entity bodies in the user's language; set language at init.

## Decision

### Locale

- `snowshoe init --json` accepts `--locale <tag>` (alias `--ui-language` / `--uiLanguage`). Tag is BCP-47 (`en`, `en-US`, …).
- Stored as ledger meta key `locale` under `.snowshoe`.
- Init is **idempotent** and may set or update locale on an existing ledger. No `snowshoe locale set` command.
- Exposed as `locale` (string or `null`) on init JSON, `work next --json`, `map status --json`, and `GET /api/session`.
- Old ledgers without locale stay `null`. Skill: deduce from conversation or ask once, then `snowshoe init --json --locale <tag>` before writing bodies.
- Util does not require locale to accept detail complete. Language of prose is a skill/human contract.

### Required entity body

- When `unchanged` is false, every upserted detail node must have non-empty (trimmed) markdown: inline `body` (alias `bodyMd`) **or** an existing file at `proseRef`.
- Inline `body` is written to `.snowshoe/map/nodes/<slug>.md` (or the provided `proseRef` under `.snowshoe/map/`). Util sets `proseRef`.
- Missing/empty body → reject `missing_body:<slug>`. Graph is not written.
- Map read-model includes resolved `bodyMd` from `proseRef` so the UI does not fetch markdown separately. Inspector renders the text (simple safe markdown); empty state if none. Dumb client: no editor.

### In-UI code preview (restore PR #11)

- Restore `GET /api/file?path=&start=&end=` as a read-only repoRoot sandbox: reject `..`, absolute paths, and symlink escape; no ledger writes.
- Map UI Code preview panel (Prism). Selecting a node with `anchors[]` preloads the first anchor (keeps the current one if it still belongs to the node). That does not switch the sidebar tab. Clicking an anchor still focuses the Code tab. `vscode://` remains secondary “Open in editor”.
- Util still does not launch an editor.

## Alternatives considered

- New `snowshoe locale set` — rejected; init amend is enough.
- Inline `body` only, drop `proseRef` files — rejected; keep markdown files as human-readable payloads under `.snowshoe/map/`.
- UI fetches markdown via a second GET — rejected for day-1; resolve `bodyMd` on the map read-model.
- Reinvent file serving — rejected; restore the PR #11 sandbox.

## Consequences

- CURRENT: locale at init; required detail body; map inspector renders `bodyMd`; in-UI preview restored.
- Skill teaches locale + required `body` in the init language; still PATH `snowshoe` only.

## Evidence

- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
- PR #11 (`cursor/map-ui-file-preview-6cb8`) for the file sandbox
