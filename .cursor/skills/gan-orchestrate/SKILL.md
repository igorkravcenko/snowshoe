---
name: gan-orchestrate
description: >-
  Run a supervised GAN loop in this repo over Orca orchestration: bind
  generator + discriminator, relay rounds, grill the user on product forks,
  stop on discriminator stop or noise. Use when grilling a PR, plan, docs, or
  implementation until merge-ready. Fail-closed if not in Orca.
---

# GAN orchestrate

You are the **coordinator**. Do not author the artifact. Do not invent a competing critique. Run a closed generator + discriminator loop on **Orca** (two roles, two supervised workers).

Workers follow: generator → `gan-generate`; discriminator → `gan-critique`. Point at those skills in each Task spec; pass round payload, do not paste their full bodies every round.

Do **not** invent a repo-local `orca-cli` skill or `references/coordinator-loop.md`. Load the version-matched Orca guide from the binary:

```text
orca skills get orchestration
```

Use `--full` / `--reference` only when that guide names a gate. Prefer `--json` on every Orca command.

## Fail-closed

This skill is Orca-only. Before binding:

1. Resolve the CLI once (`ORCA_CLI_COMMAND` if set; else `orca-dev` in an Orca dev checkout; else `orca-ide` on Linux outside an Orca-managed terminal; else `orca`). Do not fall through to another executable (on Linux, bare `orca` may be the GNOME screen reader).
2. `orca status --json` must show a running runtime. If Orca is not running or the command fails, **stop**. Tell the user to open Orca (`orca open --json` only when you are allowed to start it). Do not substitute Grok Bot teammates, Cursor subagents, chat-only parallel workers, or any non-Orca spawn.
3. Load `orca skills get orchestration` and follow that binary's loop. Do not guess retired commands (`orchestration run` / `run-stop` / `coordinator-start` are no-ops).

If you cannot prove Orca task/dispatch provenance, you are not orchestrating. Say so and stop.

## When to use

High-stakes artifact needs structured critique before merge: PR, ADR, plan note, implementation slice. Prefer this over a single free-form review when blockers must be closed explicitly.

## Phase 0 — Bind

Name and state:

- **Artifact** — path(s) / PR / note / handle
- **Kind** — `plan` | `implementation` | `docs` | other
- **Lens** (optional)
- **Generator** — who owns patches (`gan-generate` worker)
- **Discriminator** — who only critiques (`gan-critique` worker)
- **Cap** — default 6 rounds

Honor always-on locks in `.cursor/rules/project.mdc` and `docs/brain/CURRENT.md` (accepted ADRs). Do not restate them here. Protocol: `.cursor/skills/brain-protocol/SKILL.md`.

## Start (Orca)

1. Confirm artifact + kind + gen/disc (one short line).
2. Create a Run, then Tasks, then workers:

```bash
orca orchestration run-create --objective "<GAN: kind / artifact>" --json
orca orchestration task-create --spec "<self-contained worker turn>" --json
orca orchestration worker-start --task <taskId> --worktree current --agent <agent> --json
```

3. Discriminator first if the artifact exists; else generator first draft.
4. Each worker turn is self-contained: artifact, kind, lens, round number, ownership, acceptance, and "follow gan-generate" or "follow gan-critique". Attach prior Closed / Blockers / pushback.
5. Wait with rolling `check --wait` (not sleep/poll):

```bash
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
```

Process every Delivery message, reply to `question` with `orca orchestration reply`, then `--ack` and keep waiting until the expected Dispatch settles. Timeout / `{count:0}` is a checkpoint, not a worker failure.

Prefer **one** generator and **one** discriminator for the whole run. Reuse the settled worker's exact terminal for the next round:

```bash
orca orchestration worker-start --task <nextTaskId> --terminal <agent_terminal_handle> --json
```

Do not fan out. Do not start a smell-only round.

## Round loop

After a **discriminator** round:

| Discriminator said | You do |
| --- | --- |
| `discriminator stop` | Report leftover (incl. graded smells); stop-and-release |
| Only non-blockers / smells / out of scope | Classify; do **not** dispatch a smell-only patch round; stop or ask user |
| Product forks | Letter options to the user; wait; relay chosen letters to both workers |
| Blockers | Dispatch generator: patch **or** pushback per gan-generate |

After a **generator** round:

| Generator said | You do |
| --- | --- |
| Patches only | Next discriminator round (reuse discriminator terminal) |
| Pushback | Send pushback to discriminator (drop / restate with facts / product fork). Do not patch for them |
| Mix | Route patches as done; route pushback as above |

**Arbiter:** factual deadlock → decide from code/canon and tell both. Product call or unprovable → escalate to the user. Never add your own P0 on top of the discriminator.

After each accepted `worker_done`, before the next wait: **reuse** that exact terminal on the next Task, **or** `orca orchestration worker-release --dispatch <dispatchId> --json`. If the user asked to keep the pane for debugging: `orca orchestration worker-retain --dispatch <dispatchId> --json` instead of silently skipping cleanup. Do not `terminal close` when release returns `release_pending` / `release_unknown`.

## User grilling

Product forks are the user's. Letter human-readable options + a recommended letter, then **wait**. Do not resolve them yourself. Relay the chosen letters into the next Task specs.

Workers must `orca orchestration ask` for blocking product questions; you answer with `reply`. Do not tell workers to prompt the user locally.

## Cap

At cap: report closed items, remaining blockers, open disputes. Ask whether to extend on the **same** gen/disc pair (same terminals if still retained/reusable).

## Stop and release

End on discriminator stop, leftover classified as noise, user declines extend, or user aborts. Summarize outcome + evidence + unresolved leftover.

Account for every settled worker: reuse, retain (user asked), or **release**. Do not leave completed workers live merely to re-read output (`worker-read` after release). Do **not** merge PRs unless the user explicitly asked.

## Anti-patterns

- Coordinator writing the artifact or a shadow critique
- Smell-only rounds
- Swapping discriminator mid-run without a user reason
- Fanning the same round to many workers
- Teammate-chat / Grok Bot / non-Orca subagent relay
- Treating consistency-audit findings as automatic GAN blockers without a failure mode (route product/canon gaps to the user or as named blockers only when they are real acceptance misses)
