# Start here

Snowshoe's spec-driven brain: a small set of files for what is true, what is decided, what is only an experiment, and what is merely evidence.

## Read order (every session)

1. This file
2. [CURRENT.md](./CURRENT.md) — compiled truth
3. [ROADMAP.md](./ROADMAP.md) — intended sequence, not shipped fact
4. [EXPERIMENTS.md](./EXPERIMENTS.md) — registry, not truth

Then open only the ADRs, notes, or evidence the task needs.

## Trust hierarchy

| Layer | Role |
|---|---|
| `CURRENT.md` + accepted ADRs | **Truth.** Product claims and (later) behavior must match. |
| `ROADMAP.md` | Intent. May be wrong; not shipped. |
| `EXPERIMENTS.md` | Named bets. Not true until promoted via ADR + CURRENT. |
| `docs/evidence/**` | Support. **Evidence ≠ truth.** |
| `docs/brain/notes/**` | Working memory. |
| `docs/archive/**` | Superseded. Historical only. |

Research docs use YAML frontmatter `status:` (`canonical`, `accepted`, `proposed`, `superseded`, `registry`, `note`, `evidence`).

## When behavior or claims change

Write or update an ADR under [DECISIONS/](./DECISIONS/) **and** update `CURRENT.md` in the same change. Protocol: `.cursor/skills/brain-protocol/SKILL.md`.

Agent entry: [AGENTS.md](../../AGENTS.md).
