---
name: snowshoe-install
description: >-
  How to put the `snowshoe` binary on PATH from the npm registry (or `bun link` from a clone).
---

# Install `snowshoe` on PATH

The **canonical PATH binary** is `snowshoe`. Skills and agents should invoke
`snowshoe`. The npm package name is scoped `@igorkravcenko/snowshoe`
(bare npm `snowshoe` is a different, unrelated package).

Requires **Bun** (`>=1.1`).

## From the registry (preferred)

```bash
bun add -g @igorkravcenko/snowshoe
# or
npm install -g @igorkravcenko/snowshoe
command -v snowshoe
snowshoe --help   # exit 0; command index (does not mutate the ledger)
```

Still do **not** use bare npm `snowshoe` (unrelated Stamp client).
There is no Homebrew formula and no promise of bare `npx snowshoe`.

## From a clone (contributors / local link)

From the package root of this project:

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH (bun link alone does not edit your shell PATH)
command -v snowshoe
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
