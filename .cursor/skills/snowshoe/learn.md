# Snowshoe learn (map conversation)

Conversation about the mapped repo. Snowshoe does not chat, spawn the agent, or send prompts. The human types.

Do not complete claimed steps. If they want the drain queue, they re-invoke the skill.

## Live focus

Map PTY env (slug in env can go stale; the view id stays):

- `SNOWSHOE_MAP_URL` — origin of `map serve`
- `SNOWSHOE_VIEW` — view id (`?v=`)

Re-read the focused slug after they move in the tree:

```bash
snowshoe map view --json
```

(`--url` / `--id` override the env vars.)

The tree itself:

```bash
snowshoe map status --json
```

Use `map view` for “what is selected now”; use `map status` for nodes, bodies, refs, anchors. Do not invent slugs.
