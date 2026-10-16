---
status: accepted
date: 2026-10-12
---

# ADR-2026-10-12: Skill stores as an additional install path

## Status

Accepted. Extends [ADR-2026-10-03-skill-cli-install](./ADR-2026-10-03-skill-cli-install.md)
(promotes its "skill store publishing remains a later ROADMAP item" consequence).
Does **not** change drain/learn protocol. Does **not** install on `init`.

## Context

ROADMAP §3 intends publishing the product skill into harness skill stores as an
*entry* path. Claude Code reads `.claude-plugin/marketplace.json` / `plugin.json`;
the `skills` CLI (skills.sh, `npx skills add owner/repo`) discovers `SKILL.md` and
honors the same manifests. Without manifests, store installs could pick up
repo-internal dev skills under `.cursor/skills/`.

## Decision

1. Ship `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` that
   expose **only** `./skills/snowshoe`.
2. `/plugin marketplace add igorkravcenko/snowshoe` and
   `npx skills add igorkravcenko/snowshoe` are **additional** skill install paths.
3. `snowshoe skill install --json --skills-path <dir>` stays the **source of truth**
   bootstrap; the packaged `skills/snowshoe/` is the only skill SoT.
4. Store copy always requires the CLI first (`bun add -g @igorkravcenko/snowshoe`).
   Do **not** document `npm install -g` — the published bin shebang is Bun
   (`engines.bun`); npm without Bun installs then fails at runtime. README order:
   CLI on PATH (step 1), then skill (step 2).
5. Manifest `version` mirrors `package.json` `version` (Claude Code uses it for update
   detection); a test enforces lockstep.

## Alternatives considered

- Keep store publishing on ROADMAP only — rejected; manifests are cheap and scoped.
- Omit `version` from manifests to avoid drift — rejected; update detection relies on it.
- Store-first README — rejected; skill without CLI does nothing.

## Consequences

- CURRENT lists store/plugin/skills.sh as an additional entry; CLI install remains SoT.
- ROADMAP §3 marks Claude Code plugin marketplace + skills.sh as shipped manifests;
  community-catalog submissions and other stores stay intent.
- No hooks, no install on `init`, no new skill content in stores.

## Evidence

None required (packaging/distribution decision).
