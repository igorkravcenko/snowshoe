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
- **Subtitle (locked for positioning):** Don't let your agents outrun your understanding. Keep your footing.

Use Snowshoe in docs and agent language until a later ADR replaces it. Do not spend scaffold energy on renaming, trademarks, or domain hunts.

## Consequences

- CURRENT and positioning keep **provisional** + backup **Catchmark** (internal product lock)
- **User-facing** surfaces (README, CLI help, UI, packaged skills, npm `description`) ship **Snowshoe** + locked subtitle only — no Catchmark, no “working title / provisional / backup” hedges
- A future rename is an ADR + CURRENT rewrite, not a silent find-replace in chat
- Catchmark is reserved as backup only; do not ship dual branding

## Amendment 2026-09-27: PATH binary vs chat shorthand

Install / PATH command is **`snowshoe`**. Informal discussion *snow* is **not** a PATH name and must not be documented as one (global `snow` is owned by Snowflake). Chat shorthand ≠ install bin.

See [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md).

## Amendment 2026-10-04: short PATH bin `snoe`

Package `bin` ships two names to the same entrypoint:

- **`snowshoe`** — canonical install / docs / skills / agents
- **`snoe`** — short PATH alias (same binary)

Do **not** edit shell rc files. Do **not** claim `snow`. Skills and agent instructions keep calling **`snowshoe`**. If another tool already owns `snoe` on the user's PATH, the package manager / user resolves the conflict — we do not probe-and-skip at install time (`bin` is declarative).

## Amendment 2026-10-04: npm package scope

Bare npm name `snowshoe` is taken by an unrelated SnowShoe Stamp API client
(`snowshoestamp/snowshoe_node`). The registry package for this product is
**`@igorkravcenko/snowshoe`**. PATH / install binary remains **`snowshoe`**.
Do not document bare `npx snowshoe` or `npm i -g snowshoe` for this project.

## Amendment 2026-10-04: subtitle

Locked subtitle is now:

**Don't let your agents outrun your understanding. Keep your footing.**

Former line *Catch up after pull* is retired as the positioning subtitle (may still appear as colloquial product-behavior language, not brand lock).

## Amendment 2026-10-04: user-facing name surface

Backup **Catchmark** and “provisional / working title” language stay in CURRENT, this ADR, positioning, and agent rules — not in README / CLI / UI / skills / package blurb. Dual branding on public install surfaces is a defect.

## See also

Rejected naming angles (history, not canon): private maintainers note
`docs/private/notes/naming-history-rejected.md` after overlay link.
