# Skills

Harness-agnostic skill packages. Product protocol lives in the CLI (`snowshoe` on
PATH); these files teach an agent how to call it.

| Package | Role |
|---|---|
| [snowshoe/](./snowshoe/) | Product skill: `SKILL.md` gate → `drain.md` / `learn.md`; `install.md` only if the binary is missing |
| [snowshoe-scratch/](./snowshoe-scratch/) | Satellite: path without the map (`~/.snowshoe/learn/<sha256(utf8(realpath))>`). Not drain/init/ledger. Not `skill install` / plugin / npm `files` |

## Cursor

Discovery paths are symlinks:

```text
.cursor/skills/snowshoe -> ../../skills/snowshoe
.cursor/skills/snowshoe-scratch -> ../../skills/snowshoe-scratch
```

Repo process skills (`brain-protocol`, `grill-*`, `consistency-audit`) stay under
`.cursor/skills/` — they are not the product package.

## Other harnesses

Point the harness at `skills/snowshoe/` (or add a thin adapter that loads that
folder). Do not fork `drain.md` / `learn.md` per IDE.

Working repo bootstrap (CLI, opt-in):

```bash
snowshoe skill install --json --skills-path .cursor/skills   # Cursor example
snowshoe skill list --json
snowshoe skill cat --json SKILL.md
```

`--skills-path` is the harness skills directory; the CLI writes `<path>/snowshoe/`.

Until scratch install ships, using `snowshoe-scratch` **outside this clone**
means copying `skills/snowshoe-scratch/` into that harness skills dir (not a
CLI). Do not add it to `snowshoe skill install`.
