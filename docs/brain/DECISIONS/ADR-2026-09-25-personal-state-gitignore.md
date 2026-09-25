---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: Personal state gitignored by default

## Status

Accepted.

## Context

Default workflow discussion (Igor × Brainstormer, 2026-09-25): data next to the repo (e.g. `.snowshoe`) is attractive for a git-native tool, but a *personal* comprehension / competence map in shared git creates merge noise, social leakage (“who doesn’t know what”), and PR pollution. Project model and personal ledger are different objects.

## Decision

- Split **project** state (repo mental model / commit anchors / navigable structure carrier) from **personal** state (understanding heat, verified flags, competence map).
- **Personal state is gitignored / local by default** (e.g. `.snowshoe/local/` or `~/.snowshoe/<repo-id>/` — layout TBD).
- Project layer may be opt-in committed later; that is a separate decision. Explicit share / team modes are **deferred**.

## Alternatives considered

- Everything tracked under `.snowshoe/` — rejected for privacy and diff noise.
- Everything only in `~/.snowshoe` with no repo-local project layer — possible later; not required to reject repo-local *project* data.

## Consequences

- CURRENT states personal gitignore default.
- Init must create ignore rules for personal paths.
- Do not design v1 around “competence visible in every PR.”

## Evidence

Working discussion distilled in box artifact `cognitive-model-erosion/07-product-form.md` (pre-repo). Not imported wholesale; this ADR is the decision.
