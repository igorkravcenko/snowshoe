---
status: canonical
updated: 2026-09-27
---

# CURRENT

**Implementation status:** HP1–4 CLI plus a tryable local map UI and drain skill. Skill is repo-agnostic (`snowshoe` on PATH; `work next` is the entry gate). Routine epoch/CLI ADRs remain **proposed**. [ADR-2026-09-26-vertical-slice-cli.md](./DECISIONS/ADR-2026-09-26-vertical-slice-cli.md), [ADR-2026-09-27-map-ui-and-skill.md](./DECISIONS/ADR-2026-09-27-map-ui-and-skill.md), [ADR-2026-09-27-skill-drain-loop.md](./DECISIONS/ADR-2026-09-27-skill-drain-loop.md), [ADR-2026-09-27-detail-children-refs.md](./DECISIONS/ADR-2026-09-27-detail-children-refs.md).

## Product

- **Working name:** Snowshoe (provisional; not final brand). **Backup:** Catchmark.
- **Subtitle:** Catch up after pull.
- **Wedge:** git-native / ideally OSS layer for a *personal* repo comprehension map. After commits or `git pull`, show what went stale; the human chooses what to catch up on (agency). Structure exists so the human can explore and rank misunderstanding — not only consume an agent “red queue.”
- **Form (intent):** CLI-first **orchestrator** (not a passive ledger, not a full agent harness). Owns git-anchored state, freshness, and verify protocol; pluggable agent backends are workers for map / explain / quiz. Dual entry: harness skills call `snowshoe …` (PATH binary **`snowshoe`**; informal *snow* is not PATH), or the CLI invokes a configured backend (e.g. a catch-up flow). Details: [ADR-2026-09-25-product-form-orchestrator.md](./DECISIONS/ADR-2026-09-25-product-form-orchestrator.md), [ADR-2026-09-25-provisional-name-snowshoe.md](./DECISIONS/ADR-2026-09-25-provisional-name-snowshoe.md).
- **State default:** project model may live under something like `.snowshoe/`; **personal ledger gitignored / local by default**. **SQLite is source of truth** for FSM / queue / leases / epoch meta / metrics (floats `0.0–1.0`); heavy payloads are files under `.snowshoe/epochs/<epochId>/…`; markdown map/notes are human-readable, **not** SoT for metrics or step statuses. [ADR-2026-09-25-personal-state-gitignore.md](./DECISIONS/ADR-2026-09-25-personal-state-gitignore.md), [ADR-2026-09-25-implementation-stack.md](./DECISIONS/ADR-2026-09-25-implementation-stack.md).
- **v1 surfaces (intent):** primary signal where “red” arrives on delta — **opt-in** local git hook after pull/merge (+ checkout when relevant) and PR-check; navigable map is a **secondary** screen, not the product home. **Default signal:** skill → CLI. Skill entry is `snowshoe work next` (gates `init` / `routine refresh` / `routine advance` via `todo` until clear); families still *proposed*. `init` does **not** install hooks; `hooks install` / `uninstall` are opt-in. CLI always. Local GUI map is on-demand via `snowshoe map serve` (dumb client of `map status` JSON). Human marks/cancels/reloads the map; the agent completes via CLI. [ADR-2026-09-25-v1-surfaces.md](./DECISIONS/ADR-2026-09-25-v1-surfaces.md), [ADR-2026-09-27-map-ui-and-skill.md](./DECISIONS/ADR-2026-09-27-map-ui-and-skill.md), [ADR-2026-09-27-skill-drain-loop.md](./DECISIONS/ADR-2026-09-27-skill-drain-loop.md).
- **Implementation:** TypeScript on **Bun**; CLI with citty + Zod; durable machine state **`bun:sqlite`**. Map UI: React + Vite, served by `snowshoe map serve` (HTTP twins share the CLI read/mutation layer). NestJS / Next.js / Electron are out of day-1. Install bin is **`snowshoe`**; informal *snow* is not PATH. Detail complete: `children` (parent→child) + `refs` (relevance); missing/moved anchors reject. Default `work next --batch-size` is 5. [ADR-2026-09-25-implementation-stack.md](./DECISIONS/ADR-2026-09-25-implementation-stack.md), [ADR-2026-09-26-vertical-slice-cli.md](./DECISIONS/ADR-2026-09-26-vertical-slice-cli.md), [ADR-2026-09-27-map-ui-and-skill.md](./DECISIONS/ADR-2026-09-27-map-ui-and-skill.md), [ADR-2026-09-27-detail-children-refs.md](./DECISIONS/ADR-2026-09-27-detail-children-refs.md).

## Non-goals (v1)

- Chat hell / “ask the repo” as the product
- AI code review
- Multiplayer knowledge graph as the first wedge
- Agent HITL / control plane
- Nested full agent harness / competing with Cursor-class runtimes
- SaaS dashboard as the product home
- Generic “mental model / knowledge graph / agent memory” category positioning

## Monetization

Locked for now; **not implementing billing.** Ladder, do-nots, and public analog prices: [ADR-2026-09-25-monetization-ladder.md](./DECISIONS/ADR-2026-09-25-monetization-ladder.md).

OSS / local core free forever → paid sync / hosted convenience → team seats only on shared surfaces later. Solo willingness-to-pay test: **$5–20/mo**. Avoid core paywall, AI-review pricing, and enterprise day-1.

No Snowshoe ARR or user counts exist to cite. Do not invent them. There is no proven public price anchor for a “personal catch-up map.”

## Name

[ADR-2026-09-25-provisional-name-snowshoe.md](./DECISIONS/ADR-2026-09-25-provisional-name-snowshoe.md). PATH / install binary is **`snowshoe`**. Informal discussion shorthand *snow* is not CLI and not PATH. Optional user-local alias `snoe` is convenience only. Rejected naming angles (history, not canon): [notes/naming-history-rejected.md](./notes/naming-history-rejected.md).

## Now

HP1–4 CLI plus tryable `snowshoe map serve` and `.cursor/skills/snowshoe/` (PATH `snowshoe`; sibling `install.md` if the binary is missing). Slice still has no learning/quiz/verify. Proposed routine ADRs A/B are **not** promoted. Skill + payload: [ADR-2026-09-27-skill-drain-loop.md](./DECISIONS/ADR-2026-09-27-skill-drain-loop.md), [ADR-2026-09-27-detail-children-refs.md](./DECISIONS/ADR-2026-09-27-detail-children-refs.md). Manual try: [notes/how-to-try-e2e.md](./notes/how-to-try-e2e.md). Positioning: [docs/product/positioning.md](../product/positioning.md). Working notes on form detail: [notes/product-form-detail.md](./notes/product-form-detail.md).

## Process / quality

- Docs land via PR. Chief of Staff owns **consistency audit** before merge (auditor / `grill-canon`).
- Docs CI tripwire: `brain-docs` lint — [ADR-2026-09-25-brain-docs-ci.md](./DECISIONS/ADR-2026-09-25-brain-docs-ci.md).
- App CI tripwire: `typecheck`, `bun test`, Biome (`biome check .`) — [ADR-2026-09-27-app-ci-biome.md](./DECISIONS/ADR-2026-09-27-app-ci-biome.md). CI-only for now (no lefthook / husky / pre-commit). Not product `hooks install`.
- Day-1 CI supply-chain hygiene: pin Actions by SHA, `bun install --frozen-lockfile` in app CI, `SECURITY.md` — [ADR-2026-09-27-ci-supply-chain-hygiene.md](./DECISIONS/ADR-2026-09-27-ci-supply-chain-hygiene.md).
