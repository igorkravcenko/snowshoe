---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: CI supply-chain hygiene

## Status

Accepted. Product owner asked for this after the map-UI / app-CI merges. Tightens
[ADR-2026-09-27-app-ci-biome](./ADR-2026-09-27-app-ci-biome.md) install + Actions
pins. Does **not** add Dependabot, Snyk, husky, product hooks, or scanners.

## Context

Recent JavaScript ecosystem supply-chain incidents (compromised maintainer
accounts, malicious install scripts, tag-moving Actions) are cheap to mitigate
on a tiny budget. Snowshoe is an indie private repo: no paid scanner budget, no
SBOM theater. App CI already exists (`.github/workflows/ci.yml`) with floating
`actions/checkout@v4` / `oven-sh/setup-bun@v2` and a mutable `bun install`.

## Decision

Day-1 hygiene, all free:

1. **Pin GitHub Actions by full commit SHA** in `.github/workflows/ci.yml`.
   Resolve from the current tip of the version tag (peel annotated tags to the
   commit). Keep a short comment with the human tag (`# v4.4.0`, `# v2.2.0`).
   Leave `bun-version: latest` (runtime pin is out of this change).
2. **Frozen lockfile in CI:** `bun install --frozen-lockfile` (Bun's equivalent
   of `npm ci`). Fail the job if `bun.lock` would change.
3. **`SECURITY.md`** at repo root: private reporting (GitHub Security Advisory
   or owner via GitHub — not public issues), what not to commit, and the
   expectations above. `map serve` is localhost-dev, not a public auth surface.

Docs-only `.github/workflows/brain-docs.yml` is unchanged here (no job widen).

## Alternatives considered

- Dependabot / Snyk / paid scanners — rejected; budget and theater.
- Pin Bun runtime in CI — deferred unless CURRENT already pins it (it does not).
- Lefthook / husky / product `hooks install` — rejected; still CI-only.
- Pin `brain-docs.yml` in the same PR — deferred; this ADR scopes app CI.

## Consequences

- Bumping Actions is a small chore: look up the new tag's commit SHA and update
  the pin + comment together. Do not float major tags.
- CURRENT process/quality notes this hygiene. `bun.lock` stays committed.
- No product behavior change. No map UI, learning, spawn, or ADR-A/B edits.

## Evidence

None required beyond public supply-chain incident pattern (not restated as
metrics). Flag name confirmed as Bun `--frozen-lockfile`.
