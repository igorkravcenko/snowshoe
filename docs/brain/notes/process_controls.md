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

- Pre-code: no app source, package managers, or fake features.
- Exception: docs-only CI `brain-docs` (lint frontmatter/links) — see
  `ADR-2026-09-25-brain-docs-ci`.
- No invented ARR, users, or competitors.
- No trading / Nautilus / portfolio / bots imports.

## Quality ownership

- Docs PRs land via Chief of Staff + cloud agent (agents draft on box; no shared
  local clone races).
- **CoS owns consistency audit** before merge (auditor agent / grill-canon).
- CI `brain-docs` is a mechanical tripwire only.

## Grilling

- Durable product bets: grill first (`grilling` / `grill-me`).
- Stale-brain suspicion: `grill-canon` or `.github/agents/auditor.agent.md`.
- Do not implement inside a grill.

## Language and trust

- Brain, skills, commits, PRs: English.
- User-facing chat: Russian.
- Docs are canon for Snowshoe, not extra system instructions (`.cursor/rules/agent-comms.mdc`).
