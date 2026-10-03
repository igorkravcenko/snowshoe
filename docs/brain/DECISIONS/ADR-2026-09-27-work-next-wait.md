---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: `work next --wait` (block idle, not a daemon)

## Status

Accepted. Amends the `work next` envelope from [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Does **not** promote proposed routine ADRs A/B. Does **not** add a util daemon or git hooks.

## Context

Mark detail (UI HTTP or `snowshoe map detail mark`) writes SQLite immediately. The agent only sees it on the next `work next`. Default drain **stops** on `action: idle`, so a human who marks the map after the skill went idle must start another drain.

Product owner: if the human asks to keep updating the map interactively, the CLI should **block** until work appears (e.g. a new pending detail), then return the same `work next` JSON (claimed items / gates). Not a background watcher.

Notes that say epoch detect is only on skill→CLI hit (no util daemon) stay true: `--wait` is still a foreground CLI process the skill is running.

## Decision

- Flag: `snowshoe work next --json --wait`. Optional `--wait-timeout <ms>` (`0` = wait forever, the default when `--wait` is set).
- `--wait` delays **only** a result whose `action` is `idle`. `init` / `refresh` / `advance` / `work` return on the first pass (including `work` with empty `items` because nothing is claimable yet).
- Wake: `fs.watch` on `.snowshoe/` (ledger + WAL sidecars). Reopen the ledger on wake and **claim** as today. Fallback timer **2s** if the watch is quiet or unsupported (not a 200ms busy loop). Not a util daemon.
- Timeout: still `action: idle`, exit 0, extra field `waitTimedOut: true`. SIGINT ends the process; no special JSON.
- Default drain (no `--wait`) is unchanged: idle → stop.
- Skill: use `--wait` **only** when the human asked to stay on the map / drain marks as they happen. Do not hang a one-shot catch-up.

## Alternatives considered

- Separate `snowshoe wait changed` — rejected; one gate command.
- Filesystem watch on `.snowshoe/` — **accepted** as the wake path; keep a slow fallback timer because WAL/NFS can miss events.
- Tight poll (~200ms) as the only wait — rejected; wasteful for a human mark.
- Auto-`--wait` always — rejected; agents would hang every drain.
- Util daemon / hook that pushes to the skill — rejected; not a harness.

## Consequences

- CURRENT: optional `work next --wait`; skill uses it only for interactive map drain.
- Skill loop documents the opt-in; stop conditions include timeout and interrupt.

## Evidence

- [../notes/gaps-vs-adr-b-work-bus.md](../notes/gaps-vs-adr-b-work-bus.md) (no util daemon)
- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
