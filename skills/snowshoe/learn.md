# Snowshoe learn (map conversation)

Conversation about the mapped repo. Snowshoe does not chat, spawn the agent, or send prompts. The human types.

Do not invent quiz/verify features. Prefer map read-models over guessing.

**Default (learn-only):** do not complete claimed steps. If they want the drain queue alone, they re-invoke the skill on the drain branch.

**Combined mode** (map UI / UI terminal open while keep-draining — see `SKILL.md`): you may follow `drain.md` in the same invocation. Run at most one background `snowshoe work next --json --wait` (optional `--wait-timeout 0`) and keep the foreground learn/map conversation; do not kill that waiter to study the map. When the waiter returns work, handle it per `drain.md`, then restart one waiter. Never start a second waiter.

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
