# Snowshoe

[![License: Apache-2.0](https://img.shields.io/github/license/igorkravcenko/snowshoe)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/igorkravcenko/snowshoe/ci.yml?branch=main)](https://github.com/igorkravcenko/snowshoe/actions/workflows/ci.yml)

**Don't let your agents outrun your understanding. Keep your footing.**

Catch up after pull. This is the gist of what this project strives to help with. 
Snowshoe shows what in your personal understanding went stale after changes. 
You choose what to catch up on. Agents can help.

Your map lives in `.snowshoe/` and stays gitignored by default. Local, git-native,
Apache-2.0. Not a team wiki. Not an agent control panel.

<!-- TODO(OWNER): replace with docs/assets/map-after-pull.png -->
_Screenshot placeholder: map after pull (stale nodes + catch-up). See [docs/assets/](docs/assets/)._

## Install

It is advised to use Bun 1.1+. Npm will probably work fine, but it's not validated. The PATH binary is **`snowshoe`** (alias **`snoe`** is the same entrypoint).

> [!IMPORTANT]
> This project is `@igorkravcenko/snowshoe` in npm. Raw `snowshoe` without the namespace is an unrelated project.

### 1. Put `snowshoe` on PATH

**From the registry** (scoped package only):

```bash
bun add -g @igorkravcenko/snowshoe
# or: npm install -g @igorkravcenko/snowshoe
command -v snowshoe
```

**From a clone of this project** (contributors / local link):

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH
command -v snowshoe
```

### 2. Clone the repo you want to understand

Snowshoe maps **your** working tree. Clone (or open) that repository.  
It's recommended to keep it separate from the development copy, to separate learning from other work. 

```bash
git clone <your-repo> && cd <your-repo>
```

### 3. Install the skill into the agent harness

Example for Cursor:

```bash
snowshoe skill install --json --skills-path .cursor/skills
```

Other harnesses: pass their skills directory as `--skills-path`.

## Learning

1. **Open the UI**:

   ```bash
   snowshoe map serve --open
   ```

   Default port is **3232** (override with `--port`; `0` = ephemeral).

2. **Start an agent in the map UI terminal** and invoke the Snowshoe skill in **combined** mode: 
  
   ```
   /snowshoe combined
   ```
   Optionally specify the wanted language in the prompt.  
   Combined mode allows the agent to both be a worker (building and expanding the mental map), 
   and a tutor (speaking with you and teaching).  
   Do **not** start more than one worker at a time.

3. **Traverse** the mental map with the tree or the graph views. **Mark** the nodes of interest for expansion and enrichment.  
   The worker agent should receive the work you asked for, and change the map accordingly.  
   For now the map reloading is manual with `Reload` button.  
   If you  want something specific - just ask the agent.

4. **Learn** by asking your agent to explain stuff and to teach you. **Track** your understanding using corresponding metrics. 

5. **Pull** changes for the repo. Trigger the Snowshoe skill to react to changes.

Longer path: [docs/brain/notes/how-to-try-e2e.md](docs/brain/notes/how-to-try-e2e.md).

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| After a pull: what went stale. You pick what to catch up. | A chat that “knows the repo” |
| PR-check (intent; not shipped) | AI code review |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

If you're interested in a collaborative version of this for teams - let me know.

## Docs

Agents and contributors: start at [AGENTS.md](AGENTS.md).
License: [Apache 2.0](LICENSE) ([NOTICE](NOTICE)).
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
