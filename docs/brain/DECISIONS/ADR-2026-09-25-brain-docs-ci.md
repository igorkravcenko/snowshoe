---
status: accepted
date: 2026-09-25
---

# ADR: Allow docs-only brain lint CI

## Status

Accepted.

## Context

Snowshoe scaffold initially forbade CI to keep the repo pre-code and free of fake
product machinery. Docs volume is growing (ADRs, notes, evidence). Sorites runs a
`brain-docs` workflow that lint-checks brain markdown on every PR.

## Decision

Allow **docs-only** CI:

- Workflow: `.github/workflows/brain-docs.yml`
- Script: `scripts/ops/lint_brain_docs.py` (frontmatter `status`, date shapes,
  broken relative links). No application build, no package managers, no product
  fake features.

Chief of Staff owns **consistency audit** (LLM / auditor agent) on docs PRs
before merge. CI is a tripwire, not a substitute for that audit.

## Consequences

- Update AGENTS.md, `.cursor/rules/project.mdc`, and `process_controls` so the
  blanket “no CI” rule becomes “no app/CI except brain-docs lint”.
- Do not add test matrices, release pipelines, or app CI until CURRENT + ADR say so.
