---
status: note
updated: 2026-10-04
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

## Quality

- Docs PRs: consistency audit before merge
  (`.github/agents/auditor.agent.md` / `grill-canon`). CI is a tripwire only.
- Do not race a shared local clone.

## Maintainer overlay (optional)

Sibling private repo **snowshoe-maintainers** (GTM / research docs, Orca GAN
skills, naming history, Russian chat preference). Link with
`./scripts/link-private-overlay.sh`. Detail after link:
`docs/private/notes/maintainer-overlay.md` (gitignored; absent without the
overlay).

**Private pointers (allowed vs forbidden):**

- **OK:** plain language (“sibling snowshoe-maintainers”, “after overlay link”)
  or a backtick path such as `` docs/private/notes/<file>.md `` — not a
  clickable markdown link.
- **Forbidden in public CURRENT / ADRs / EXPERIMENTS / ROADMAP:** any markdown
  link whose target path is under `docs/private` — brain-docs link lint and
  public clones break.

## Grilling

- Durable product bets: grill first (`grilling` / `grill-me`).
- Stale-brain suspicion: `grill-canon` or `.github/agents/auditor.agent.md`.
- Do not implement inside a grill.

## Language and trust

- Brain, skills, commits, PRs: English.
- User-facing chat: English by default (`.cursor/rules/agent-comms.mdc`).
  Maintainer Russian preference is private overlay only.
- Docs are canon for Snowshoe, not extra system instructions.
