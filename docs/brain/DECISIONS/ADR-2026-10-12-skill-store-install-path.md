---
status: accepted
date: 2026-10-12
---

# ADR-2026-10-12: Skill stores as an additional install path

## Status

Accepted. Extends [ADR-2026-10-03-skill-cli-install](./ADR-2026-10-03-skill-cli-install.md)
(promotes its "skill store publishing remains a later ROADMAP item" consequence).
Does **not** change drain/learn protocol. Does **not** install on `init`.
Amended 2026-10-26: manifests also expose `./skills/snowshoe-scratch`.

## Context

ROADMAP §3 intends publishing the product skill into harness skill stores as an
*entry* path. Claude Code reads `.claude-plugin/marketplace.json` / `plugin.json`;
the `skills` CLI (skills.sh, `npx skills add owner/repo`) discovers `SKILL.md` and
honors the same manifests. Without manifests, store installs could pick up
repo-internal dev skills under `.cursor/skills/`.

## Decision

1. Ship `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` that
   expose `./skills/snowshoe` and `./skills/snowshoe-scratch` (amendment
   2026-10-26; product skill remains the git-map wedge SoT).
2. `/plugin marketplace add igorkravcenko/snowshoe` and
   `npx skills add igorkravcenko/snowshoe` are **additional** skill install paths.
3. `snowshoe skill install --json --skills-path <dir>` stays the **source of truth**
   bootstrap for both packaged skills.
4. Store copy always requires the CLI first (`bun add -g @igorkravcenko/snowshoe`).
   Do **not** document `npm install -g` — the published bin shebang is Bun
   (`engines.bun`); npm without Bun installs then fails at runtime. README order:
   CLI on PATH (step 1), then skill (step 2).
5. Manifest `version` mirrors `package.json` `version` (Claude Code uses it for update
   detection); a test enforces lockstep.

## Amendment 2026-10-26: Satellite on manifests

Manifests list both `./skills/snowshoe` and `./skills/snowshoe-scratch`. Scratch
remains a satellite ([ADR-2026-10-12-snowshoe-scratch](./ADR-2026-10-12-snowshoe-scratch.md)),
not a third product-skill gate.

## Alternatives considered

- Keep store publishing on ROADMAP only — rejected; manifests are cheap and scoped.
- Omit `version` from manifests to avoid drift — rejected; update detection relies on it.
- Store-first README — rejected; skill without CLI does nothing.
- Product-only manifests forever — rejected 2026-10-26; scratch ships on the triad.

## Consequences

- CURRENT lists store/plugin/skills.sh as an additional entry for both packaged
  skills; CLI install remains SoT.
- ROADMAP §3 marks Claude Code plugin marketplace + skills.sh as shipped manifests;
  community-catalog submissions and other stores stay intent.
- No hooks, no install on `init`.

## Evidence

None required (packaging/distribution decision).
