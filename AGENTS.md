# AGENTS

Entrypoint for agents working in this repo.

1. Read [docs/brain/START_HERE.md](docs/brain/START_HERE.md).
2. Follow the read order there: **CURRENT → ROADMAP → EXPERIMENTS**.
3. Load `.cursor/skills/brain-protocol/SKILL.md` before changing product claims or behavior.
4. Treat **CURRENT + active ADRs** as truth. Evidence, notes, and experiments are not.

## Product (one line)

**Snowshoe** (provisional; backup **Catchmark**) — *Catch up after pull.* A git-native / ideally OSS personal repo comprehension map. Implementation status: **pre-code / scaffold only**.

## Hard rules

- English for `docs/brain/**`, skills, rules, this file, commits, and PRs.
- User-facing chat: Russian (see `.cursor/rules/agent-comms.mdc`).
- No application code, package managers, CI, or fake features unless CURRENT + an ADR say so.
- Do not invent ARR, users, or competitors. Unknown stays `unknown`.
- Do not import trading / Nautilus / portfolio / bots from other repos.

## Skills

| Skill | When |
|---|---|
| `brain-protocol` | Session start; any canon or behavior change |
| `grilling` | Stress-test a plan or decision (rounds + frontier) |
| `grill-me` | User says "grill me" / wants to be interviewed |
| `grill-canon` | Audit CURRENT/ADRs for staleness or contradiction |
