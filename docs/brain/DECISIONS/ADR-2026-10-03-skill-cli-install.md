---
status: accepted
date: 2026-10-03
---

# ADR-2026-10-03: Skill CLI install (list / cat / install)

## Status

Accepted. Extends [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md)
(harness-agnostic SoT at `skills/snowshoe/`). Does **not** change drain/learn
protocol. Does **not** install on `init`. Amended 2026-10-26: multi-package
install + `--update`.

## Context

The product skill lived only in the Snowshoe source tree (and Cursor symlink).
A working repo with `snowshoe` on PATH still had no harness skill files, so
agents could not self-bootstrap. Hardcoding `--harness cursor|…` in the CLI
fights multi-harness ports; paths differ per tool.

## Decision

Ship the packaged skills with the CLI and expose:

| Command | Role |
|---|---|
| `snowshoe skill list --json` | Inventory packaged packages/files |
| `snowshoe skill cat --json [--package <name>] <file>` | Print one file |
| `snowshoe skill install --json --skills-path <dir>` | Copy into `<dir>/<package>/` |

Rules:

1. **Opt-in.** Not part of `init`. Same posture as hooks.
2. **`--skills-path` required** on install. Harness/agent chooses the directory
   (e.g. `.cursor/skills`). No `--harness` enum in the util.
3. **Copy** files from the package SoT under the running package root
   (`skills/<name>/`). Not a symlink into the global install.
4. **Idempotent.** Identical files → `changed: false`. Divergent existing files
   → fail unless `--update` or `--force` (same overwrite path; prefer `--update`
   in help/errors). Byte compare only; no installed semver stamp.
5. **No `skill path` in v1** — list/cat/install are enough for agents.
6. `snowshoe help --json` mentions install when the repo has no skill yet.

## Amendment 2026-10-26: Multi-package + `--update`

1. Packaged registry is **`snowshoe`** (`SKILL.md`, `drain.md`, `learn.md`,
   `install.md`) and satellite **`snowshoe-scratch`** (`SKILL.md` only). Install
   copies both into `<skills-path>/snowshoe/` and `<skills-path>/snowshoe-scratch/`.
2. `skill list` returns both packages. `skill cat` defaults to `--package
   snowshoe`; use `--package snowshoe-scratch` for the satellite.
3. Install JSON uses `packages: [{ name, targetDir, sourceDir, written,
   unchanged, changed }, …]` plus top-level `changed` / `skillsPath` /
   `update` / `force`.
4. `--update` overwrites package-tracked files that differ; `--force` remains
   an alias of the same overwrite behavior.

## Alternatives considered

- Auto-install on `init` — rejected (hooks precedent; surprise writes into harness dirs).
- `--harness cursor` mapping — rejected; path belongs to the caller.
- `skill path` only — rejected as insufficient for setup; omitted from MVP.
- Symlink to package root — rejected for target repos (fragile across machines).
- Semver stamp in installed skill files — rejected this slice; byte compare is enough.

## Consequences

- CURRENT documents the three commands, multi-package install, and opt-in
  `--skills-path` / `--update`.
- Gate/`install.md` may point agents at `skill install` after PATH is present.
- Skill store publishing: [ADR-2026-10-12-skill-store-install-path](./ADR-2026-10-12-skill-store-install-path.md).

## Evidence

None required beyond the chicken/egg bootstrap gap (evidence ≠ truth).
