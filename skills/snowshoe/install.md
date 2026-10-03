---
name: snowshoe-install
description: >-
  How to put the `snowshoe` binary on PATH (`bun link` / scoped registry).
---

# Install `snowshoe` on PATH

The **canonical PATH binary** is `snowshoe`. A short PATH alias **`snoe`**
points at the same entrypoint (package `bin`). Skills and agents should still
invoke `snowshoe`. The npm package name is scoped `@igorkravcenko/snowshoe`
(bare npm `snowshoe` is a different, unrelated package).

## From a clone (current day-1)

Requires **Bun** (`>=1.1`). From the package root:

```bash
bun install --frozen-lockfile
bun link
```

Put Bun’s global bin on PATH (often `~/.bun/bin`). Then:

```bash
command -v snowshoe
command -v snoe
snowshoe --help
```

`bun link` is **one global** symlink. It does not follow git worktrees. If you
link clone A, then `cd` to clone B and run `snowshoe map serve`, the **ledger**
is B but the **map UI** is still A’s `ui/dist`. To serve B’s UI: `bun link`
from B, or from B run `bun src/index.ts map serve`.

Equivalent link via npm (still from this package root):

```bash
npm link
```

There is no Homebrew formula and no promise of bare `npx snowshoe`.

## When the scoped package is published

```bash
bun add -g @igorkravcenko/snowshoe
# or
npm install -g @igorkravcenko/snowshoe
```

That still installs **`snowshoe`** and **`snoe`** on PATH.

## Skill files into a working repo (opt-in)

With `snowshoe` on PATH, copy the packaged product skill into the harness skills
directory the agent uses (path is harness-specific — not guessed by the CLI):

```bash
# Cursor example
snowshoe skill install --json --skills-path .cursor/skills
```

Other harnesses: pass their skills directory as `--skills-path`. Idempotent;
`--force` overwrites files that differ. Not part of `snowshoe init`.

List / read without writing:

```bash
snowshoe skill list --json
snowshoe skill cat --json SKILL.md
```
