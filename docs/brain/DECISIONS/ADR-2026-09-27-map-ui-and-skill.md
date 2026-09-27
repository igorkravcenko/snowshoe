---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Tryable map UI + skill (no learning)

## Status

Accepted. Authorizes a local map HTTP UI and an agent-loadable skill so a human can try the chained E2E in [../notes/e2e-happy-path-no-learning.md](../notes/e2e-happy-path-no-learning.md). Does **not** promote proposed routine ADRs A/B. Does **not** make the map the product home.

## Context

[ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) shipped the HP1–4 CLI. The stack ADR already points at React + Vite + local HTTP for `snowshoe map`, as a later face of the same util. The E2E note defines tryable as: init → skill drain → open map UI → walk → mark → drain → reload → open leaf via anchors → optional HEAD move → refresh/epoch/advance → reload.

UI ↔ ledger split: UI never opens SQLite, never writes the ledger, never calls `work complete`. Skill is an external agent loop; util does not spawn.

## Decision

Ship, in this slice:

1. **`snowshoe map serve`** — tiny localhost HTTP server. `GET /api/map/status` and `POST /api/map/detail/mark|cancel` are twins of the existing CLI commands and call the **same** `runMapStatus` / `runMapDetailMark` / `runMapDetailCancel` functions. Optional `GET /api/session` exposes `repoRoot` / `gitHead` for editor links only (not the map read-model).
2. **Map UI** — React + Vite, tree-first, static assets served by that HTTP server. Float→color/bands computed **in the UI** using ADR-A display thresholds. Code open: in-UI preview plus secondary `vscode://file…` from `anchors[]` ([ADR-2026-09-27-locale-body-preview](./ADR-2026-09-27-locale-body-preview.md)). Util does not launch an editor.
3. **Skill package** at `.cursor/skills/snowshoe/` — documentation + drain-loop instructions for an external agent. Util does not spawn, watch, or install hooks.

Skill contract (PATH `snowshoe`, `work next` gating, default `--batch-size` 5, sibling `install.md`): [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Detail payload `children` + `refs` and hard-reject unresolved anchors: [ADR-2026-09-27-detail-children-refs](./ADR-2026-09-27-detail-children-refs.md).

`.snowshoe/**` stays gitignored / uncommitted. A/B stay **proposed**; this ADR must not be read as rewriting those bodies.

## Alternatives considered

- Separate Vite-only static host plus a second writer — rejected; one util layer.
- Nest / Next / Electron — already out of day-1 (stack ADR).
- Skill that shells into a util-spawned agent — rejected; Snowshoe does not spawn.
- Promoting A/B in the same change — rejected; still proposed.

## Consequences

- CURRENT implementation status includes a tryable local map UI + skill, still no learning/quiz/verify.
- Navigable map remains a **secondary** surface (surfaces ADR). This slice only makes that on-demand face runnable.
- Test runner stays `bun test`. UI smoke does not replace HP1–4 CLI tests.

## Evidence

- [../notes/e2e-happy-path-no-learning.md](../notes/e2e-happy-path-no-learning.md)
- [../notes/ui-ledger-split.md](../notes/ui-ledger-split.md)
- [../notes/skill-worker-contract.md](../notes/skill-worker-contract.md)
- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
