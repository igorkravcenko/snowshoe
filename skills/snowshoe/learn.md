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

The tree / local graph (default columns are `slug` + `children`; `--all-fields` for bodies/anchors):

```bash
snowshoe map status --json --slug <focus>
snowshoe map status --json --neighborhood --slug <focus>
snowshoe map status --json --fields title,type,leaf,children,refs,bodyOverview --slug <focus>
```

Prefer `bodyOverview` when scanning many nodes; use `bodyMd` / `--all-fields` when the human needs full prose. Wiki links `[[slug]]` in bodies navigate in the map UI only (not auto-refs).