---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: App CI (typecheck, tests, Biome)

## Status

Accepted. Authorizes TypeScript quality CI alongside docs-only `brain-docs`. Does **not** add consumer git hooks, lefthook, husky, or pre-commit.

## Context

[ADR-2026-09-25-brain-docs-ci](./ADR-2026-09-25-brain-docs-ci.md) allowed **docs-only** CI and deferred app CI until CURRENT + an ADR said so. [ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) shipped HP1–4 TypeScript on Bun. Docs lint no longer covers `src/` / `tests/`.

Need a tripwire for typecheck, unit tests, and format/lint. Single formatter+linter (no ESLint + Prettier pair). Not a product `hooks install` surface.

## Decision

- **Biome** is the format + lint tool (`biome check .`). No ESLint, no Prettier.
- **Scripts** in `package.json`: keep `typecheck` (`tsc --noEmit`) and `test` (`bun test`); add `lint` / `format` / `check` via Biome (`biome check .` and `biome check --write .` for local fix).
- **Workflow** `.github/workflows/ci.yml` on pull_request and push to `main`: `bun install`, `bun run typecheck`, `bun test`, `biome check .` (via `bun run check`).
- Keep `.github/workflows/brain-docs.yml` running as today. CoS consistency audit is unchanged.
- Commit `biome.json`. Ignore build artifacts (`node_modules`, `dist`, `build`, `ui/dist`, `.snowshoe`) and the lockfile if Biome would touch it. Recommended lint preset; `noNonNullAssertion` off so existing `!` in tests/CLI is not a rewrite.
- **CI-only** for now: no lefthook / husky / pre-commit in this change. Not consumer `snowshoe hooks install`.

## Alternatives considered

- ESLint + Prettier — rejected; two tools for one job.
- Lefthook / husky / git pre-commit — deferred; CI gate first.
- Fold app checks into `brain-docs.yml` — rejected; docs lint stays Python/docs-only.
- Vitest in CI instead of `bun test` — rejected for this change; the slice runner is `bun test`.

## Consequences

- CURRENT process/quality cites both `brain-docs` and this app CI.
- AGENTS / project rules drop “no app/build CI yet.”
- No product behavior change. No map UI. No ledger rewrite.

## Evidence

None beyond the vertical-slice CLI already on `main`.
