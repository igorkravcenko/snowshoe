---
status: living
updated: 2026-09-27
---

# ROADMAP

Intent only. Not truth. Not a commitment to dates. Implementation stack is locked: [ADR-2026-09-25-implementation-stack](./DECISIONS/ADR-2026-09-25-implementation-stack.md). CLI slice: [ADR-2026-09-26-vertical-slice-cli](./DECISIONS/ADR-2026-09-26-vertical-slice-cli.md). Map UI + skill: [ADR-2026-09-27-map-ui-and-skill](./DECISIONS/ADR-2026-09-27-map-ui-and-skill.md).

## 0. Brain

Spec-driven scaffold: CURRENT, ADRs, evidence vs truth, agent protocol.

## 1. Lock v1 surfaces (no code yet)

Grill remaining UX/copy ([ADR-2026-09-25-v1-surfaces](./DECISIONS/ADR-2026-09-25-v1-surfaces.md) is accepted at intent-level; flags and copy still open):

- What “signal after pull” actually shows (copy, urgency, grey ≠ red)
- What “PR-check” is (and is not — not AI review)
- Local / git-native shape of personal vs project state (gitignore default + SQLite/files/markdown layering are locked; on-disk layout TBD)
- Minimal CLI contract (`init` / `refresh` / `status` / `learn` / `verify` — draft only; proposed routine families are **not** CURRENT)
- Hooks: **opt-in**, not default `init` (accepted). Remaining work is copy / which hook names, not auto-install.

## 2. First local slice (HP1–4 CLI + tryable map)

Init, detail map, routine epoch, mixed queue, local `snowshoe map serve`, in-repo drain skill. No learning. Do not pre-build a platform (no Nest/Next/Electron day-1).

## 3. Harness skills (parallel, after form lock)

Publish skills into popular harness skill stores as an *entry* path (Orca-supported agents as a non-binding reference list). Skills teach the protocol; state stays with the CLI. See evidence: skills overlap brief.

## 4. Paid convenience (later)

Only after a local core exists. Sync / hosted freshness / multi-device — see monetization ADR. Billing is not in scope now.

## 5. Team seats (later still)

Only on shared surfaces, when a second person is on the same map. Not a solo seat tax.

## Explicitly not on this roadmap

Enterprise-only GTM, multiplayer KG, agent control plane, AI-review product, trading/Nautilus leftovers, early SaaS dashboard as home.
