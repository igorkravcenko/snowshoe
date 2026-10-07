---
status: accepted
date: 2026-10-07
---

# ADR-2026-10-07: Map soft-init, skill combined mode, default port 3232

## Status

Accepted. Amends [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md) (soft-init + port) and [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md) (combined mode). Does **not** ship learning/quiz/verify. Does **not** rewrite README QuickStart.

## Context

`map serve` called `requireInitialized` before listen, so opening the UI without `.snowshoe/` hard-crashed. Agents often want the empty map + terminal first, then init via skill. Skill gate forbade reading both `drain.md` and `learn.md`, which blocked "keep draining while studying in the map UI/PTY". Default port `8787` conflicts with Wrangler.

## Decision

1. **Soft-init.** `snowshoe map serve` boots without a ledger. UI assets and loopback Host checks stay. `GET /api/session` and `GET /api/map/status` return HTTP 200 with `initialized: false`, empty `nodes`, and an actionable `hint` / `cta` (mention `snowshoe init` / skill). Ledger-needing routes (mark / detail / file / metric / …) still fail with JSON 4xx via `requireInitialized` (same hint). In-memory `/api/view` and loopback PTY keep working. UI renders empty map + CTA and disables mark actions until initialized.

2. **Combined skill mode.** When map UI / UI terminal / map PTY is live **and** the human wants keep-draining in the same session, the gate allows reading **both** `drain.md` and `learn.md`. Background: one `snowshoe work next --json --wait` (optional `--wait-timeout 0`); foreground learn/map conversation — do not kill the waiter to study. Still at most one waiter; restart after handling work. Learn-only still does not complete claimed steps.

3. **Default port `3232`.** `map serve` default and CLI `--port` default become `3232` (`0` = ephemeral). Vite dev proxy follows. Docs/tests that hardcode the old default update; README QuickStart narrative is out of scope.

## Alternatives considered

- Keep hard-init and document "init first" — rejected; empty+CTA is the tryable path.
- Separate combined skill file — rejected; progressive disclosure in the same package.
- Keep 8787 — rejected; Wrangler clash.

## Consequences

- CURRENT: soft-init map serve; combined skill mode; default port 3232.
- Skill contract tests assert combined language, not exclusive drain/learn.
- No quiz/verify; no README QuickStart rewrite in this change.

## Evidence

- Map serve / skill package under `src/map/`, `skills/snowshoe/`, `ui/src/`
