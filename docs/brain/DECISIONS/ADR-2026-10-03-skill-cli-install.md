---
status: accepted
date: 2026-10-03
---

# ADR-2026-10-03: Skill CLI install (list / cat / install)

## Status

Accepted. Extends [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md)
(harness-agnostic SoT at `skills/snowshoe/`). Does **not** change drain/learn
protocol. Does **not** install on `init`.

## Context

The product skill lived only in the Snowshoe source tree (and Cursor symlink).
A working repo with `snowshoe` on PATH still had no harness skill files, so
agents could not self-bootstrap. Hardcoding `--harness cursor|…` in the CLI
fights multi-harness ports; paths differ per tool.

## Decision

Ship the packaged skill with the CLI and expose:

| Command | Role |
|---|---|
| `snowshoe skill list --json` | Inventory packaged files |
| `snowshoe skill cat --json <file>` | Print one file (`SKILL.md` \| `drain.md` \| `learn.md` \| `install.md`) |
| `snowshoe skill install --json --skills-path <dir>` | Copy into `<dir>/snowshoe/` |

Rules:

1. **Opt-in.** Not part of `init`. Same posture as hooks.
2. **`--skills-path` required** on install. Harness/agent chooses the directory
   (e.g. `.cursor/skills`). No `--harness` enum in the util.
3. **Copy** files from the package SoT (`skills/snowshoe/` next to the running
   package root). Not a symlink into the global install.
4. **Idempotent.** Identical files → `changed: false`. Divergent existing files
   → fail unless `--force`.
5. **No `skill path` in v1** — list/cat/install are enough for agents.
6. `snowshoe help --json` mentions install when the repo has no skill yet.

## Alternatives considered

- Auto-install on `init` — rejected (hooks precedent; surprise writes into harness dirs).
- `--harness cursor` mapping — rejected; path belongs to the caller.
- `skill path` only — rejected as insufficient for setup; omitted from MVP.
- Symlink to package root — rejected for target repos (fragile across machines).

## Consequences

- CURRENT documents the three commands and opt-in `--skills-path`.
- Gate/`install.md` may point agents at `skill install` after PATH is present.
- Skill store publishing remains a later ROADMAP item; CLI is the day-1 bootstrap.

## Evidence

None required beyond the chicken/egg bootstrap gap (evidence ≠ truth).
