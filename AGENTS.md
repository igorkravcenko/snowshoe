# AGENTS

Entrypoint for agents working in this repo.

1. Read [docs/brain/START_HERE.md](docs/brain/START_HERE.md).
2. Follow the read order there: **CURRENT → ROADMAP → EXPERIMENTS**.
3. Load `.cursor/skills/brain-protocol/SKILL.md` before changing product claims or behavior.
4. Treat **CURRENT + accepted ADRs** as truth. Evidence, notes, and experiments are not.

## Product (one line)

**Snowshoe** (provisional; backup **Catchmark**) — *Don't let your agents outrun your understanding. Keep your footing.* A git-native personal comprehension map of a repository (Apache-2.0). Implementation status: **HP1–4 CLI + tryable map UI/skill**; routine ADRs A/B remain proposed. Install / PATH: **`snowshoe`** via **`@igorkravcenko/snowshoe`**; informal *snow* is not PATH. Skills/agents call **`snowshoe`**. Default signal is skill/human → CLI (`work next` gates `init` / `routine refresh` / `advance`). `init` does **not** install git hooks; opt-in hooks remain intent (CLI not shipped). Stack + clarifications: [ADR-2026-09-25-implementation-stack](docs/brain/DECISIONS/ADR-2026-09-25-implementation-stack.md). Slices: [ADR-2026-09-26-vertical-slice-cli](docs/brain/DECISIONS/ADR-2026-09-26-vertical-slice-cli.md), [ADR-2026-09-27-map-ui-and-skill](docs/brain/DECISIONS/ADR-2026-09-27-map-ui-and-skill.md), [ADR-2026-09-27-skill-drain-loop](docs/brain/DECISIONS/ADR-2026-09-27-skill-drain-loop.md).

## Hard rules

- English for `docs/brain/**`, skills, rules, this file, commits, and PRs.
- User-facing chat: English by default (see `.cursor/rules/agent-comms.mdc`). Maintainer Russian-chat preference is private overlay only.
- No learning/quiz/verify, agent spawn, or fake features beyond the HP1–4 CLI + tryable map UI/skill unless CURRENT + an ADR say so.
- **CI:** docs `brain-docs` lint ([ADR-2026-09-25-brain-docs-ci](docs/brain/DECISIONS/ADR-2026-09-25-brain-docs-ci.md)) plus app CI (`typecheck`, `bun test`, Biome) ([ADR-2026-09-27-app-ci-biome](docs/brain/DECISIONS/ADR-2026-09-27-app-ci-biome.md)). No lefthook / husky / pre-commit yet. Product git-hook CLI is not shipped.
- Do not invent ARR, users, or competitors. Unknown stays `unknown`.
- Do not import trading / Nautilus / portfolio / bots from other repos.
- **Quality:** Chief of Staff owns consistency audit on docs PRs before merge (`.github/agents/auditor.agent.md` / `grill-canon`). Agents draft packages carefully; do not race a shared local clone.

## Skills

| Skill | When |
|---|---|
| `brain-protocol` | Session start; any canon or behavior change |
| `grilling` | Stress-test a plan or decision (rounds + frontier) |
| `grill-me` | User says "grill me" / wants to be interviewed |
| `grill-canon` | Audit CURRENT/ADRs for staleness or contradiction |
| `snowshoe` | Product skill at `skills/snowshoe/` (Cursor: `.cursor/skills/snowshoe` symlink). Gate: PATH `snowshoe` (`install.md` only if missing), then `drain.md` (`work next`) or `learn.md`. Working repo without skill files: `snowshoe skill install --json --skills-path <harness-skills-dir>` |
| `.github/agents/auditor.agent.md` | Read-only consistency audit (CoS before merge) |

Maintainer-only overlay lives in the sibling private repo `snowshoe-maintainers`. Link with `./scripts/link-private-overlay.sh` (or set `SNOWSHOE_MAINTAINERS`):

- `.cursor/skills/gan-*` — Orca GAN skills
- `docs/private` — GTM / monetization research / competitive evidence / naming history
- `.cursor/rules/maintainer-chat.mdc` — optional Russian chat preference

Symlinks are gitignored. Public CURRENT/ADRs must not depend on `docs/private` links. Product CLI/map does not depend on the overlay.
