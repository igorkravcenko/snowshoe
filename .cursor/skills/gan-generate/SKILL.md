---
name: gan-generate
description: >-
  Act as the generator in an Orca GAN loop: own a named artifact and on each
  critique either patch or reasoned pushback. Use when the coordinator
  assigns you as generator (gan-orchestrate).
disable-model-invocation: true
---

# GAN generate

You **own** the named artifact. Discriminator critique is input, not orders. The coordinator runs the loop via `gan-orchestrate` on **Orca**; you only act as the generator. Do not run the orchestration loop yourself.

You are an Orca **worker**. Follow the live dispatch preamble. After the round, send `worker_done` once and end the turn. Do not spawn subagents or start a competing coordinator.

## Phase 0 — Role

Name and confirm:

- **Artifact** — path(s), PR, note, ADR draft, or other durable handle
- **Kind** — `plan` | `implementation` | `docs` | other short label
- **Lens/spec** (optional)

Done: artifact + kind named; you will patch this target, not a competing draft.

## Each round

Read the current artifact and every **blocker** the coordinator sent. For **each** blocker, exactly one:

1. **Patch** — smallest reasonable fix that hits the failure mode. Prefer a cleaner seam over pasting the critique verbatim. Cite what changed.
2. **Pushback** — why the item is wrong, out of scope, or would make the artifact worse. Facts from code/canon. What you would do instead, if anything. Do not silently drop it.

No silent ignore. No drive-by refactors. Do not write a competing discriminator round (no Closed / Blockers / Smells form).

**Smells** are not blockers:

- `should` — patch if cheap and in-slice, else one-line skip (not silent)
- `note` — ignore, or tiny if you already touch the line

Do not start a refactor epic from a smell list.

First draft (no artifact yet): produce a minimal complete target for the stated kind/lens, then wait for critique.

## Product forks

Do not decide product calls yourself. `ask` the coordinator with lettered **human-readable** options and a recommended letter:

```bash
orca orchestration ask --question "<lettered options + recommended letter>" --timeout-ms 600000 --json
```

Do not prompt the user in the local TUI.

## Done signal

Send **one** Orca `worker_done` from this terminal (IDs from the preamble):

```bash
orca orchestration send --type worker_done --subject "<round status>" --body "<worker_done report>" --task-id <taskId> --dispatch-id <dispatchId> --outcome succeeded --files-modified "path/a,path/b" --json
```

Use `--outcome failed` when the round hard-failed; never encode failure only in prose. Then **end the turn**. The coordinator may reuse or release this terminal.

`worker_done` body:

- every blocker: **patched** (what) or **pushback** (why)
- smell `should`: patched or skipped with one line
- paths / PR head when you edited
- open product-fork questions, if any (prefer `ask` before `worker_done` if you are blocked on a letter)

## Rules

- Hit the failure mode, not the critic's prose.
- One slice per round: do not mix a P0 bugfix with a policy rewrite unless the round said to.
- Title and gates must match real done for that target.
- Honor always-on locks in `.cursor/rules/project.mdc` and `docs/brain/CURRENT.md` (accepted ADRs). Do not restate them here.
- If the preamble is stale or absent, do not send lifecycle messages; inspect state or treat the prompt as an ordinary handoff.
