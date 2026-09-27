---
name: gan-orchestrate
description: >-
  Run a supervised GAN loop in this repo: bind generator + discriminator,
  relay rounds, grill the user on product forks, stop on discriminator stop
  or noise. Use when grilling a PR, plan, docs, or implementation until
  merge-ready.
---

# GAN orchestrate

You are the **coordinator**. Do not author the artifact. Do not invent a competing critique. Run a closed generator + discriminator loop (two roles; may be two agents or two sticky modes).

Workers follow: generator → `gan-generate`; discriminator → `gan-critique`. Point at those skills; pass round payload, do not paste their full bodies every round.

## When to use

High-stakes artifact needs structured critique before merge: PR, ADR, plan note, implementation slice. Prefer this over a single free-form review when blockers must be closed explicitly.

## Phase 0 — Bind

Name and state:

- **Artifact** — path(s) / PR / note / handle
- **Kind** — `plan` | `implementation` | `docs` | other
- **Lens** (optional)
- **Generator** — who owns patches (e.g. author cloud agent)
- **Discriminator** — who only critiques (default: `gan-critique` mode)
- **Cap** — default 6 rounds

## Start

1. Confirm artifact + kind + gen/disc (one short line).
2. Discriminator first if the artifact exists; else generator first draft.
3. Each worker turn is self-contained: artifact, kind, lens, round number, ownership, acceptance, and "follow gan-generate" or "follow gan-critique". Attach prior Closed / Blockers / pushback.

Prefer **one** generator and **one** discriminator for the whole run. Do not fan out.

## Round loop

After a **discriminator** round:

| Discriminator said | You do |
| --- | --- |
| `discriminator stop` | Report leftover (incl. graded smells); end loop |
| Only non-blockers / smells / out of scope | Classify; do **not** dispatch a smell-only patch round; stop or ask user |
| Product forks | Letter options to the user; wait; relay chosen letters to both workers |
| Blockers | Dispatch generator: patch **or** pushback per gan-generate |

After a **generator** round:

| Generator said | You do |
| --- | --- |
| Patches only | Next discriminator round |
| Pushback | Send pushback to discriminator (drop / restate with facts / product fork). Do not patch for them |
| Mix | Route patches as done; route pushback as above |

**Arbiter:** factual deadlock → decide from code/canon and tell both. Product call or unprovable → escalate to the user. Never add your own P0 on top of the discriminator.

## Cap

At cap: report closed items, remaining blockers, open disputes. Ask whether to extend on the **same** gen/disc pair.

## Stop

End on discriminator stop, leftover classified as noise, user declines extend, or user aborts. Summarize outcome + evidence + unresolved leftover. Do **not** merge PRs unless the user explicitly asked.

## Anti-patterns

- Coordinator writing the artifact or a shadow critique
- Smell-only rounds
- Swapping discriminator mid-run without a user reason
- Fanning the same round to many workers
- Treating consistency-audit findings as automatic GAN blockers without a failure mode (route product/canon gaps to the user or as named blockers only when they are real acceptance misses)
