# Snowshoe

**Don't let your agents outrun your understanding. Keep your footing.**

After a pull or a big merge, Snowshoe shows what in your personal map went stale.
You choose what to catch up on. Agents can help. They don't get to outrun you.

Your map lives in `.snowshoe/` and stays gitignored. Local, git-native,
Apache-2.0. Not a team wiki. Not an agent control panel.

## Install

You need Bun 1.1+.

From a clone, today:

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH
snowshoe init --json --locale en
```

That puts `snowshoe` on PATH once `~/.bun/bin` is on PATH. Short alias: `snoe`
(same binary).

Do not `npm i -g snowshoe`. That name is an unrelated stamp client. This project
is `@igorkravcenko/snowshoe` once published: `bun add -g @igorkravcenko/snowshoe`.

`snowshoe init` does not install git hooks. Hooks and the PR check are opt-in
later (CLI not shipped yet). Default signal is skill/human → CLI.

## How to try

1. `snowshoe init --json --locale en`
2. `snowshoe map serve --open` and walk the tree
3. Optional: load `skills/snowshoe/` and let an agent run `snowshoe work next`

Contributor checks: `bun test`, `bun run typecheck`, `bun run check`.
Longer path: [docs/brain/notes/how-to-try-e2e.md](docs/brain/notes/how-to-try-e2e.md).

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| After a pull: what went stale. You pick what to catch up. | A chat that “knows the repo” |
| PR-check | AI code review |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

## Docs

Agents and contributors: start at [AGENTS.md](AGENTS.md).
License: [Apache 2.0](LICENSE) ([NOTICE](NOTICE)).
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).

OSS / local core **free forever**. No billing in this repo.
Policy: [docs/brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md](docs/brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md).
