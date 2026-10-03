---
status: note
date: 2026-09-25
---

# Note: What a glued “composite skill” still lacks

**Status:** working note (not CURRENT, not ADR). Grill before promoting.  
**Trigger:** After ranking (private maintainers evidence `docs/private/evidence/2026-09-25-solutions-ranking.md` when linked), question: if we compose mentor + learn-codebase + Code-Atlas-style delta + quiz into one skill, what is still missing?

## Short answer

A composite skill is still **prompt orchestration inside a foreign harness**, not the product. Glue covers pedagogy workers; it does not own the Snowshoe core.

## Still missing after glue

1. **Durable personal state outside chat** — ledger must live gitignored / local (e.g. `~/.snowshoe/` or `.snowshoe/` personal layer), survive model switch, context clear, other IDE. Skills writing session markdown or tracked `docs/` either lose state or leak competence into the repo.

2. **Git-anchored freshness as computation** — “after pull, redden touched nodes” needs diff → code↔model map → heuristic *how much this invalidates understanding at level X*. Atlas-like tools do structural out-of-sync; mentor does time/concept decay. Neither (nor a skill asking the model) is a stable “commit anchor → red queue” pipeline. Agent re-guesses staleness each time → recognition theatre.

3. **Transparent map + agency outside chat** — glue stays a dialogue checklist. Product intent: second screen so the human *chooses* what to learn, not drown in teach-flow.

4. **Verify as contract, not tone** — “human answer = only green” in SKILL.md is easy to bypass (agent paints green “for convenience,” human OK without recall). Need a state machine (pending → challenged → verified) that **refuses** green without pass — code/CLI, not a paragraph.

5. **Orchestrator: who to call, when done, what to write** — per form ADR intent: `snow` owns state / anchors / freshness / verify; agent is pluggable worker. A composite skill *is* the agent: nested loops, harness-specific SKILL.md behavior, no single `snow refresh` / post-merge hook.

6. **Signal on the human’s delta workflow** — post-pull/merge hook, terminal `status`, optional PR-check. A skill runs only if someone remembers to invoke it; IDE “catch me up” habit wins by default.

7. **Portability across harnesses** — one SKILL.md ≠ same behavior in Cursor / Claude Code / Codex / OpenCode. State + freshness should be CLI-native; skills = thin adapters (“call snow, don’t paint green”). Else GTM = N fragile copies.

8. **False closure / naming** — `catchup` in registries already means *agent session* recovery. A composite skill without the product core collapses into briefing + checkbox quiz (recognition≠recall).

## What glue *is* good for

v0 **pedagogy workers** (explain / quiz) **beside** an existing `snow` state + refresh core. Not a substitute for that core.

## Suggested promotion path

- If the product owner agrees: thin ADR “skills are adapters; snow owns protocol” (may already be covered by product-form orchestrator ADR — avoid duplicate; link instead).  
- Keep this file as note until CURRENT explicitly states the “glue ≠ product” boundary.
