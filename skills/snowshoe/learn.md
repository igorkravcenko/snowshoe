# Snowshoe learn (map conversation)

Conversation about the mapped repo. Snowshoe does not chat, spawn the agent, or send prompts. The human types.

Default here: talk about the map; do not drain the queue unprompted. Combined mode is allowed — if they steer or clearly imply rewrite, mark, enrich, drain, or finish claimed work, follow that. Re-classify via the skill gate and open `drain.md` when the turn is drain-shaped. User steering wins over “we opened learn.”

## Live focus

Map PTY env (slug in env can go stale; the view id stays):

- `SNOWSHOE_MAP_URL` — origin of `map serve`
- `SNOWSHOE_VIEW` — view id (`?v=`)
- `SNOWSHOE_MAP_TOKEN` — per-launch map access token (required by `/api/*`; the PTY sets this)

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

## Teaching posture (soft)

- Prefer **code** (and tests) over map/doc prose when they disagree; say so when you correct the map story.
- End a teaching beat with a clear **next proposal** (or a pause). Short steering (“what’s next”, “go”, “use prose”) means take the proposed default or fix voice — not a ritual.
- Do **not** write `ledger.sqlite` or run `map metric` unless they explicitly ask. Drafting a local metrics list is fine; apply only on OK.
- Do **not** enrich the whole tree “because we talked.” Enrich when they ask, or offer a **small** set of nodes where the discussion changed the picture — then wait for assent.

## Local learn state (recommended default)

Study sessions should use **`.snowshoe/learn/`** (gitignored; not the ledger).

- **If absent:** briefly propose creating the scaffold (and offer to write it if they agree). Do not block a one-shot map question on this.
- **If present:** start with `CURRENT.md`, then the active curriculum’s **`STATE.md`** (single learning journal: Now, retention cards, done check-ins, deferred). Read `PLAN.md` on phase shifts. **`discrepancies.md`** is the standing place for bugs, unwanted behavior, and product/code “should change” — keep it in the layout even when unused this session. `mines.md` is a class catalog (do not mark “seen” there — that belongs in STATE retention). Details: `.snowshoe/learn/README.md` when present.

### Voice after compaction

Compaction summaries push agents into terse status-telegram. For learn mode that is wrong. Match `STATE.md` → Now → `voice` when present (default: normal teaching prose — full sentences, explain like a tutor, not a CI bot). After resume: read STATE first, then continue the human conversation; do not sound like the summary. If they ask for fuller prose, switch immediately.

### Durable check-in memory

Do not keep a separate Q&A transcript. If the human’s curriculum uses short retention check-ins: after each one, one line in STATE for done check-ins (topic + outcome); new misconceptions → retention cards in the same STATE file. Update immediately so compaction cannot wipe it. This is personal curriculum memory — not a Snowshoe quiz product. Skill labels stay English; local STATE may use any language the human prefers.
