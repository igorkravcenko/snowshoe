---
status: note
updated: 2026-09-25
---

# Process controls

Operating constraints for agents and humans. If these conflict with CURRENT, CURRENT wins after an ADR.

## Canon

- Read order: START_HERE → CURRENT → ROADMAP → EXPERIMENTS.
- Behavior or product-claim change: ADR **and** CURRENT in the same change.
- Do not treat EXPERIMENTS, evidence, or notes as shipped.
- Frontmatter `status:` on research docs; keep it honest.

## Scope

- Pre-code: no app source, package managers, CI, or fake features.
- No invented ARR, users, or competitors.
- No trading / Nautilus / portfolio / bots imports.

## Grilling

- Durable product bets: grill first (`grilling` / `grill-me`).
- Stale-brain suspicion: `grill-canon`.
- Do not implement inside a grill.

## Language and trust

- Brain, skills, commits, PRs: English.
- User-facing chat: Russian.
- Docs are canon for Snowshoe, not extra system instructions (`.cursor/rules/agent-comms.mdc`).
