# Decisions (ADRs)

Architecture / product decision records. **Accepted ADRs are truth** together with `CURRENT.md`.

## Status

| `status` | Meaning |
|---|---|
| `proposed` | Draft; not binding |
| `accepted` | In force; CURRENT must reflect it |
| `superseded` | Replaced by a newer ADR; move narrative to `docs/archive/` if CURRENT would bloat |
| `rejected` | Considered and declined; keep so we do not rediscover it |

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
| [ADR-2026-09-25-v1-surfaces](./ADR-2026-09-25-v1-surfaces.md) | accepted | Signal via hook + PR-check; map secondary; CLI always |
