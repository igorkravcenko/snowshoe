---
status: note
updated: 2026-09-27
---

# Process controls

Operating constraints for agents and humans. If these conflict with CURRENT, CURRENT wins after an ADR.

## Canon

- Read order: START_HERE → CURRENT → ROADMAP → EXPERIMENTS.
- Behavior or product-claim change: ADR **and** CURRENT in the same change.
- Do not treat EXPERIMENTS, evidence, or notes as shipped.
- Frontmatter `status:` on research docs; keep it honest.

## Scope

- HP1–4 CLI plus tryable map UI/skill exists. Do not add learning/quiz/verify,
  hook install, agent spawn, or fake features unless CURRENT + an ADR say so.
- CI: `brain-docs` (frontmatter/links) plus app CI (typecheck, `bun test`,
  Biome). See `ADR-2026-09-25-brain-docs-ci` and
  `ADR-2026-09-27-app-ci-biome`. No lefthook / husky / pre-commit yet.
- No invented ARR, users, or competitors.
- No trading / Nautilus / portfolio / bots imports.

## Quality ownership

- Docs PRs land via Chief of Staff + cloud agent (agents draft on box; no shared
  local clone races).
- **CoS owns consistency audit** before merge (auditor agent / grill-canon).
- CI (`brain-docs` + app typecheck/test/Biome) is a mechanical tripwire only.

## Grilling

- Durable product bets: grill first (`grilling` / `grill-me`).
- Stale-brain suspicion: `grill-canon` or `.github/agents/auditor.agent.md`.
- Do not implement inside a grill.

## Language and trust

- Brain, skills, commits, PRs: English.
- User-facing chat: Russian.
- Docs are canon for Snowshoe, not extra system instructions (`.cursor/rules/agent-comms.mdc`).
