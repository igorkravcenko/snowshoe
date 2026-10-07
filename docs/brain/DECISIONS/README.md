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
| [ADR-2026-09-25-provisional-name-snowshoe](./ADR-2026-09-25-provisional-name-snowshoe.md) | accepted | Working name Snowshoe; backup Catchmark; subtitle lock; PATH bin `snowshoe` |
| [ADR-2026-09-25-monetization-ladder](./ADR-2026-09-25-monetization-ladder.md) | accepted | OSS core free forever; billing off; WTP/paid sketches private |
| [ADR-2026-09-25-personal-state-gitignore](./ADR-2026-09-25-personal-state-gitignore.md) | accepted | Personal ledger gitignored / local by default |
| [ADR-2026-09-25-product-form-orchestrator](./ADR-2026-09-25-product-form-orchestrator.md) | accepted | CLI-first orchestrator; agents are pluggable workers |
| [ADR-2026-09-25-v1-surfaces](./ADR-2026-09-25-v1-surfaces.md) | accepted | Accepted (intent); UX/copy still open; hooks opt-in (not default init) |
| [ADR-2026-09-25-brain-docs-ci](./ADR-2026-09-25-brain-docs-ci.md) | accepted | Docs-only brain-docs lint CI; CoS owns consistency audit |
| [ADR-2026-09-25-implementation-stack](./ADR-2026-09-25-implementation-stack.md) | accepted | TS/Bun stack; SQLite ledger; hooks opt-in; state layering |
| [ADR-2026-09-25-routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md) | proposed | Routine epochs, learning split, mandatory metric decay |
| [ADR-2026-09-25-routine-cli-and-fsm](./ADR-2026-09-25-routine-cli-and-fsm.md) | proposed | Routine CLI families, FSM ownership, work queue |
| [ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) | accepted | First application code: HP1–4 CLI, no learning; A/B stay proposed |
| [ADR-2026-09-27-app-ci-biome](./ADR-2026-09-27-app-ci-biome.md) | accepted | App CI: typecheck, bun test, Biome; keep brain-docs; no lefthook |
| [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md) | accepted | Tryable local map UI (`map serve`) + drain skill; A/B stay proposed |
| [ADR-2026-09-27-ci-supply-chain-hygiene](./ADR-2026-09-27-ci-supply-chain-hygiene.md) | accepted | Pin Actions SHA + frozen-lockfile CI + SECURITY.md; no paid scanners |
| [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md) | accepted | Skill at `skills/snowshoe/` (+ Cursor symlink); `work next` gates; PATH `snowshoe`; batch 5 |
| [ADR-2026-09-27-detail-children-refs](./ADR-2026-09-27-detail-children-refs.md) | accepted | Detail `children`/`refs`; parent enrich; retire/clearEdges in subtree |
| [ADR-2026-09-27-work-next-wait](./ADR-2026-09-27-work-next-wait.md) | accepted | `work next --wait` blocks idle; not a daemon; skill opt-in |
| [ADR-2026-09-29-map-pty-channel](./ADR-2026-09-29-map-pty-channel.md) | accepted | Loopback-peer PTY in map UI + `map view`; not chat/HITL/learning |
| [ADR-2026-09-30-agent-feedback-inbox](./ADR-2026-09-30-agent-feedback-inbox.md) | accepted | Optional agent JSONL inbox in `.snowshoe/feedback/`; sidebar tab; not v1 |
| [ADR-2026-09-30-user-asked-mark-and-help](./ADR-2026-09-30-user-asked-mark-and-help.md) | accepted | Agent mark if user asked this turn; `snowshoe help --json` |
| [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md) | accepted | Leaf stop-flag; expand/enrich/fix hops; durable anchors; narrower split |
| [ADR-2026-10-02-map-nav-tabs](./ADR-2026-10-02-map-nav-tabs.md) | accepted | Left column tabs: Tree / Graph / human Todos (`learn`/`quiz`) |
| [ADR-2026-10-02-map-local-graph](./ADR-2026-10-02-map-local-graph.md) | accepted | Radial ego Graph tab; one MapReadModel; History prev/next borders |
| [ADR-2026-10-02-map-metric-cli](./ADR-2026-10-02-map-metric-cli.md) | accepted | `map metric` sets node floats; HTTP twin; not work next / not quiz |
| [ADR-2026-10-02-detail-body-wiki](./ADR-2026-10-02-detail-body-wiki.md) | accepted | `detail` hop = expand∪enrich; `bodyOverview`; UI wiki `[[slug]]` |
| [ADR-2026-10-02-apache-2-0-license](./ADR-2026-10-02-apache-2-0-license.md) | accepted | Product repo licensed Apache-2.0 (`LICENSE` + `NOTICE`) |
| [ADR-2026-10-05-inbox-marks](./ADR-2026-10-05-inbox-marks.md) | accepted | System inbox marks `new`/`decayed`; Todos Inbox/Later; read on leave |
| [ADR-2026-10-06-anchor-locator-offset](./ADR-2026-10-06-anchor-locator-offset.md) | accepted | Required `locatorOffset`; identity = startLine+offset; legacy 0 |
| [ADR-2026-10-07-soft-init-combined-port](./ADR-2026-10-07-soft-init-combined-port.md) | accepted | Soft-init map serve; skill combined drain+learn; default port 3232 |
