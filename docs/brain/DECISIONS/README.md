# Decisions (ADRs)

Architecture / product decision records. **Accepted ADRs are truth** together with `CURRENT.md`.

## Status

| `status` | Meaning |
|---|---|
| `proposed` | Draft; not binding |
| `accepted` | In force; CURRENT must reflect it |
| `superseded` | Replaced by a newer ADR; move narrative to `docs/archive/` if CURRENT would bloat |
| `rejected` | Considered and declined; keep so we do not rediscover it |

The in-force word is **`accepted`**. Lint still allows `active` as an alias; do not use `active` on new ADRs.

## Rules

- One decision per file.
- Filename: `ADR-YYYY-MM-DD-short-slug.md`
- Use [../templates/DECISION_TEMPLATE.md](../templates/DECISION_TEMPLATE.md)
- Behavior or claim changes: ADR **and** CURRENT update in the same change
- Do not invent metrics or users in the "Consequences" section

## Index

| ADR | Status | One line |
|---|---|---|
| [ADR-2026-09-25-provisional-name-snowshoe](./ADR-2026-09-25-provisional-name-snowshoe.md) | accepted | Working name Snowshoe; backup Catchmark |
| [ADR-2026-09-25-monetization-ladder](./ADR-2026-09-25-monetization-ladder.md) | accepted | OSS core free → paid convenience → team seats later |
| [ADR-2026-09-25-personal-state-gitignore](./ADR-2026-09-25-personal-state-gitignore.md) | accepted | Personal ledger gitignored / local by default |
| [ADR-2026-09-25-product-form-orchestrator](./ADR-2026-09-25-product-form-orchestrator.md) | accepted | CLI-first orchestrator; agents are pluggable workers |
| [ADR-2026-09-25-v1-surfaces](./ADR-2026-09-25-v1-surfaces.md) | accepted | Accepted (intent); UX/copy still open |
| [ADR-2026-09-25-brain-docs-ci](./ADR-2026-09-25-brain-docs-ci.md) | accepted | Docs-only brain-docs lint CI; CoS owns consistency audit |
| [ADR-2026-09-25-routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md) | proposed | Routine epochs, learning split, mandatory metric decay |
| [ADR-2026-09-25-routine-cli-and-fsm](./ADR-2026-09-25-routine-cli-and-fsm.md) | proposed | Routine CLI families, FSM ownership, work queue |
