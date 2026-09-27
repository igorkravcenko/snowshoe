# AGENTS

Entrypoint for agents working in this repo.

1. Read [docs/brain/START_HERE.md](docs/brain/START_HERE.md).
2. Follow the read order there: **CURRENT → ROADMAP → EXPERIMENTS**.
3. Load `.cursor/skills/brain-protocol/SKILL.md` before changing product claims or behavior.
4. Treat **CURRENT + accepted ADRs** as truth. Evidence, notes, and experiments are not.

## Product (one line)

**Snowshoe** (provisional; backup **Catchmark**) — *Catch up after pull.* A git-native / ideally OSS personal repo comprehension map. Implementation status: **HP1–4 CLI vertical slice (no learning)**; routine ADRs A/B remain proposed. CLI spelling is provisional `snowshoe …`; informal *snow* is not CLI. Default signal is skill/human → CLI (`routine refresh` / `status` / `work`); git hooks are **opt-in** (`hooks install` / `uninstall`) — `init` does not install them. Stack + clarifications: [ADR-2026-09-25-implementation-stack](docs/brain/DECISIONS/ADR-2026-09-25-implementation-stack.md). Slice: [ADR-2026-09-26-vertical-slice-cli](docs/brain/DECISIONS/ADR-2026-09-26-vertical-slice-cli.md).

## Hard rules

- English for `docs/brain/**`, skills, rules, this file, commits, and PRs.
- User-facing chat: Russian (see `.cursor/rules/agent-comms.mdc`).
- No learning/quiz/verify, agent spawn, or fake features beyond the HP1–4 CLI unless CURRENT + an ADR say so.
- **CI:** docs `brain-docs` lint ([ADR-2026-09-25-brain-docs-ci](docs/brain/DECISIONS/ADR-2026-09-25-brain-docs-ci.md)) plus app CI (`typecheck`, `bun test`, Biome) ([ADR-2026-09-27-app-ci-biome](docs/brain/DECISIONS/ADR-2026-09-27-app-ci-biome.md)). No lefthook / husky / pre-commit yet. Not product `hooks install`.
- Do not invent ARR, users, or competitors. Unknown stays `unknown`.
- Do not import trading / Nautilus / portfolio / bots from other repos.
- **Quality:** Chief of Staff owns consistency audit on docs PRs before merge (`.github/agents/auditor.agent.md` / `grill-canon`). Agents draft packages on the shared box; do not race a shared local clone.

## Skills

| Skill | When |
|---|---|
| `brain-protocol` | Session start; any canon or behavior change |
| `grilling` | Stress-test a plan or decision (rounds + frontier) |
| `grill-me` | User says "grill me" / wants to be interviewed |
| `grill-canon` | Audit CURRENT/ADRs for staleness or contradiction |
| `.github/agents/auditor.agent.md` | Read-only consistency audit (CoS before merge) |
