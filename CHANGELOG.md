# Changelog

## Unreleased

- **Compatibility:** skills installed before this change stop while `leased` is non-empty (they only look at `items`). After upgrading the CLI, reinstall / update the snowshoe skill (`snowshoe skill install --json --skills-path <dir>`, or your plugin / skills.sh update).
- `work complete --help --json`: `mapHops` changed from a string to an object (`{ payloads, rejectReasons }`).
- Learn / scratch: append host conversation/session ids to `sessions.md` (not STATE). Do not read that file in the teaching loop.
- `work next` echoes live leftovers in `leased[]` (same tokens; mint while leftovers exist is allowed). Skill lease order: own work (`items` + own `leased`) first; foreign `leased` only once no own work is left (after compaction every `leased` counts as foreign). Queue-visible work is map hops plus the open epoch’s routine steps. Refresh `todo` wins (`leased: []` on that gate); `work complete` tells a lost lease (`lease_reclaimed`: expired and re-claimed by another `work next`; skip) apart from a bad token (`bad_lease`; STOP), and rejects routine steps with `refresh_required` while the refresh gate shows and `epoch_not_open` from a superseded epoch ([#16](https://github.com/igorkravcenko/snowshoe/issues/16)).
- `work complete --help` documents `blast_radius` and `metric_decay` payloads, per-kind reject codes (map hops, `structure_sync`, `blast_radius`, `metric_decay`, `work fail`; a test keeps them in sync with the code) and common reject codes (`unknown_step`, `kind_mismatch`, `already_closed`, `bad_lease`, `lease_reclaimed`, `epoch_not_open`, `refresh_required`, `lease_expired`, `unknown_kind`), exit codes, required `metric_decay` `reason`, the decay-only intent (new value ≤ currently stored value; fresh map-hop nodes start at 0, so only 0 is accepted), and severity caps (`null` = level not required) ([#36](https://github.com/igorkravcenko/snowshoe/issues/36)).
- Omit `leaf` on an existing upsert keeps the stored flag; a new node omit still stores `false`; an expand / detail / fix hop that adds children clears the parent’s flag when its upsert omits `leaf`; `fix` items get the same `allowedChildTypes` as expand ([#37](https://github.com/igorkravcenko/snowshoe/issues/37)).

## 0.0.6 — 2026-10-16

Patch after [v0.0.5](https://github.com/igorkravcenko/snowshoe/releases/tag/v0.0.5). Merged PRs **#19** onward.

### Skills and install

- Claude Code plugin / marketplace manifests and skills.sh install path ([#19](https://github.com/igorkravcenko/snowshoe/pull/19))
- One-line human intro at the top of `SKILL.md` ([#20](https://github.com/igorkravcenko/snowshoe/pull/20))
- README: why Snowshoe helps ([#21](https://github.com/igorkravcenko/snowshoe/pull/21))
- Satellite `snowshoe-scratch` skill and global `--cwd` (WIP; not on `skill install`, plugin manifests, or npm `files`) ([#22](https://github.com/igorkravcenko/snowshoe/pull/22))
- `init` gitignore anchors to `/.snowshoe` so skill dirs stay trackable ([#23](https://github.com/igorkravcenko/snowshoe/pull/23))
- Public PATH install is **`bun add -g @igorkravcenko/snowshoe`**; do not advertise `npm i -g` (bin shebang is Bun) ([#31](https://github.com/igorkravcenko/snowshoe/pull/31))
- Learn / scratch **re-entry**: reprint the landed floor after a wiped-context break (`STATE.md` Re-entry block). Trigger is `re-entry`; short steering is not. Skill labels English; local STATE may use any language.

### CLI and map

- Mark is the work queue; green is the metric solid band (assent this turn) ([#24](https://github.com/igorkravcenko/snowshoe/pull/24))
- `work complete --help` documents `structure_sync` `upsert_node` replace-vs-omit ([#26](https://github.com/igorkravcenko/snowshoe/pull/26))
- `snowshoe --version` prints `package.json` ([#27](https://github.com/igorkravcenko/snowshoe/pull/27))
- `map serve --open` tells the user when a browser cannot launch ([#28](https://github.com/igorkravcenko/snowshoe/pull/28))
- Root `snowshoe` / `--help` print a human usage postcard; `help --json` stays the agent index ([#29](https://github.com/igorkravcenko/snowshoe/pull/29))
- Spaced negative `map metric` values are usage errors; drop invalid IPv6 CSP `ws://[::1]` ([#30](https://github.com/igorkravcenko/snowshoe/pull/30))

**npm:** `@igorkravcenko/snowshoe@0.0.6` (maintainer publishes)

```bash
bun add -g @igorkravcenko/snowshoe@latest
# requires Bun on PATH
snowshoe map serve --open
```
