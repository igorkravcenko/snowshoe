---
status: evidence
date: 2026-09-25
---

# Evidence: Harness skills overlap vs Snowshoe wedge

**Source:** Market Researcher scan (2026-09-25), metadata-only / anti-prompt-injection protocol.  
**Full working copy on shared box:** `/workspace/snowshoe-skills-overlap-brief.md`  
**This file:** condensed English for the repo. Evidence ≠ truth.

## Question

Do existing agent skills (Cursor / Claude / Codex / cross-agent registries, Orca-supported harnesses as reference) already solve the *same* problem as Snowshoe?

**Same-problem checklist:** personal human comprehension ledger on a git project · stale after pull/merge/large PR · freshness (“red on delta”) · transparent map so human ranks learning · verify/teach-back without unilateral green.

## Method (safety)

Default: store blurbs, titles, SKILL.md frontmatter `name`/`description`, short README quotes. Did **not** install or execute skill bodies as instructions.

## Verdict

**Crowded adjacent / empty on the exact wedge.** No skill found that owns the full checklist. Closest cluster: pedagogy / teach-back skills (personal journals, quizzes, no-unilateral-green). Missing product piece: git-delta freshness + agency map after pull.

## Closest partials (by description)

| Name | Overlap | Gap vs Snowshoe |
|---|---|---|
| mentor (tempoloss / anek-dev) | personal ledger + teach-back / explain-back gates | no git-anchored “red after pull” map product |
| ktaletsk/learn-codebase | learning journal 🔴🟡🟢; session mental model | cold-start tutoring, not continuous pull freshness |
| comprehend / learn-quiz | teach-to-mastery; human answer = green | subject often session/diff; checklists often in tracked docs |
| mattpocock/teach | stateful teaching workspace | separate learning repo pattern, not overlay + stale-after-delta |
| session skills named `catchup` | git/plans for *agent* context recovery | **not** human comprehension — naming collision |
| repo wiki / onboarding generators | structure for docs | not personal ledger |
| agent `ledger` skills | institutional / agent memory | explicitly not human competence map |

## GTM implications (opinion → see notes)

- Skill metadata must say *human* + *after pull* + *freshness* + *verify*.  
- Avoid bare skill id `catchup`.  
- Skills = harness entry; CLI owns state.  
- May compose with teach-back skills as workers.

## Gaps

GuildSkills/ClaudSkills full search behind account; Cursor private marketplaces; Goose marketplace URL 404 at scan time; full crawl of 190k+ skills impossible — rare miss possible.
