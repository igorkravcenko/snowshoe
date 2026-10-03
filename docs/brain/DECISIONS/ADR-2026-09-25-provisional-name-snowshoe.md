---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: Provisional name Snowshoe

## Status

Accepted.

## Context

The product needs a working name in-repo (docs, agents, GitHub). The brand is not final.

## Decision

- **Working name:** Snowshoe
- **Backup:** Catchmark
- **Subtitle (locked for positioning):** Catch up after pull

Use Snowshoe in docs and agent language until a later ADR replaces it. Do not spend scaffold energy on renaming, trademarks, or domain hunts.

## Consequences

- CURRENT, README, and positioning say "provisional"
- A future rename is an ADR + CURRENT rewrite, not a silent find-replace in chat
- Catchmark is reserved as backup only; do not ship dual branding

## Amendment 2026-09-27: PATH binary vs chat shorthand

Install / PATH command is **`snowshoe`**. Informal discussion *snow* is **not** a PATH name and must not be documented as one (global `snow` is owned by Snowflake). Chat shorthand ≠ install bin.

Optional user-local shell alias (e.g. `alias snoe=snowshoe`) is convenience only — not an install name, not claimed on PATH.

See [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md).

## See also

Rejected naming angles (history, not canon): private maintainers note
`docs/private/notes/naming-history-rejected.md` after overlay link.
