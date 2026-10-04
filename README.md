# Snowshoe

[![License: Apache-2.0](https://img.shields.io/github/license/igorkravcenko/snowshoe)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/igorkravcenko/snowshoe/ci.yml?branch=main)](https://github.com/igorkravcenko/snowshoe/actions/workflows/ci.yml)

**Don't let your agents outrun your understanding. Keep your footing.**

Do not `npm i -g snowshoe`. That package is an unrelated stamp client. This
project is `@igorkravcenko/snowshoe`.

After a pull or a big merge, Snowshoe shows what in your personal map went stale.
You choose what to catch up on. Agents can help. They don't get to outrun you.

Your map lives in `.snowshoe/` and stays gitignored. Local, git-native,
Apache-2.0. Not a team wiki. Not an agent control panel.

<!-- TODO(OWNER): replace with docs/assets/map-after-pull.png -->
_Screenshot placeholder: map after pull (stale nodes + catch-up). See [docs/assets/](docs/assets/)._

## Install

You need Bun 1.1+.

### From a clone (works today)

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH
snowshoe init --json --locale en
```

That puts **`snowshoe`** on PATH once `~/.bun/bin` is on PATH. Short alias:
**`snoe`** (same binary).

`snowshoe init` does not install git hooks. Opt-in hooks and the PR check are
intent for later (CLI not shipped yet). Default signal is skill/human → CLI.

### After publish

When `@igorkravcenko/snowshoe` is on the registry (not yet today):

```bash
bun add -g @igorkravcenko/snowshoe
# or: npm install -g @igorkravcenko/snowshoe
snowshoe init --json --locale en
```

Still do **not** use bare npm `snowshoe` (unrelated Stamp client).

## How to try

1. `snowshoe init --json --locale en`
2. `snowshoe map serve --open` and walk the tree
3. Optional: load `skills/snowshoe/` and let an agent run `snowshoe work next`

Longer path: [docs/brain/notes/how-to-try-e2e.md](docs/brain/notes/how-to-try-e2e.md).
Contributor checks live in [CONTRIBUTING.md](CONTRIBUTING.md).

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| After a pull: what went stale. You pick what to catch up. | A chat that “knows the repo” |
| PR-check (intent; not shipped) | AI code review |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

## Docs

Agents and contributors: start at [AGENTS.md](AGENTS.md).
License: [Apache 2.0](LICENSE) ([NOTICE](NOTICE)).
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
