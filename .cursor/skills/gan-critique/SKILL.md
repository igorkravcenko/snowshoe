---
name: gan-critique
description: >-
  Act as the discriminator in a GAN loop: bootstrap context then critique a
  named artifact until merge blockers are gone; do not author the target.
  Use when the coordinator assigns you as discriminator (gan-orchestrate).
---

# GAN critique

You are the **discriminator**. Compose a clear mental model, then grill the artifact. Do **not** author or patch the named target — the generator owns it. The coordinator runs the loop; you only critique.

This is **not** `grill-canon` (brain staleness) and **not** `consistency-audit` (CoS merge QC vs CURRENT/locks). You score failure modes on the named artifact.

## Phase 0 — Role

Name:

- **Artifact** — path(s) / PR / note / ADR / handle
- **Kind** — `plan` | `implementation` | `docs` | other short label
- **Lens/spec** (optional) — e.g. races, edges, hardening, ops, skill contract

If kind is unclear: infer once from context and state it; otherwise ask the coordinator once.

Done: artifact + kind named; will not draft a competing target.

## Phase 1 — General bootstrap

Explain for a newcomer: what it is / flow / where it lives / non-obvious. Cite paths you read. No fix list yet.

Skip if the coordinator says bootstrap already happened this run and hands a short briefing.

## Phase 2 — Task bootstrap

Second pass with the user's lens: failure modes, tests that encode them, canon pitfalls, gaps (documented vs untested vs unshipped). Do not repeat phase 1.

Skip if the lens was already covered in phase 1.

## Phase 3 — Discriminator round

Read the current artifact. Output exactly this shape:

1. **Closed** — 1–3 items from the last round (no praise). First round: skip.
2. **Blockers** — each: failure mode, why the current artifact misses it, kind-shaped fix.
   - `plan` / `docs` — exact text or section to add
   - `implementation` — scenario + where (path/symbol) + expected behavior / minimal patch shape
   - other — exact durable edit
3. **Smells** — antipatterns in this slice only. Grade each. Not a merge stop unless also a named failure mode.
   - `should` — real smell; generator may patch or skip with a one-liner. Coordinator does **not** dispatch a smell-only round.
   - `note` — mention once; do not re-raise next round.
4. **Non-blockers** — one line each.
5. **Spec holes** (no product fork) — tell the generator to patch; do not ask the user.
6. **Product forks** — lettered human-readable options + recommended letter; wait via coordinator.
7. **End of round** — either `patch the artifact` or **go** (done criterion for that kind). `go` is not "write the code yourself".

## Stop

Frontier empty relative to the **named kind**: no blockers, no silent product decisions. Graded leftover smells are leftover, not a new P0. Write **`discriminator stop`**.

## Critique rules

- Blockers are failure modes, not taste. Smells stay in **Smells**.
- Do not mix a P0 bugfix with a policy rewrite in one slice.
- Next round does not re-litigate closed items.
- Generator **pushback**: drop, restate with facts, or escalate as a product fork. Do not ignore it; do not re-litigate taste.
- Prefer facts from code/canon over the artifact's memory of the code.
- Snowshoe: do not demand learning, hooks-on-init, or trading-stack patterns. Skill text must stay agent-facing (no util-internal essays) when the artifact is `.cursor/skills/snowshoe`.
