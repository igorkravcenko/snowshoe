# Skills

Harness-agnostic skill packages. Product protocol lives in the CLI (`snowshoe` on
PATH); these files teach an agent how to call it.

| Package | Role |
|---|---|
| [snowshoe/](./snowshoe/) | Product skill: `SKILL.md` gate → `drain.md` / `learn.md`; `install.md` only if the binary is missing |

## Cursor

Discovery path is a symlink:

```text
.cursor/skills/snowshoe -> ../../skills/snowshoe
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
