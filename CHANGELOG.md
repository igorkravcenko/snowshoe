# Changelog

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
