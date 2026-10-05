---
status: accepted
date: 2026-09-29
updated: 2026-10-04
---

# ADR-2026-09-29: Map UI localhost PTY channel (not chat, not learning)

## Status

Accepted. Authorizes a **loopback-peer PTY** in `snowshoe map serve` and `snowshoe map view` so a human in the map tab can run their usual TUI agent with live map focus. Does **not** ship explain/quiz/verify. Does **not** promote proposed routine ADRs A/B. Does **not** make the map a HITL control plane.

## Context

Catch-up map UI is a browser tab. A Snowshoe-owned chat would pin one agent backend. A second OS window for the agent is a bad learn rhythm. The human already runs shells locally; `map serve` is localhost HTTP.

Focus lives in RAM (`GET /api/view/:id`). Shell env is a snapshot; the CLI must **re-read** slug after tree clicks.

## Decision

1. **Channel, not chat.** Map UI may embed a PTY (xterm) as the first sidebar tab. Snowshoe does not spawn an agent, send prompts, or tell the agent to open a node. The human types.
2. **Fuse is peer, not bind.** PTY/WebSocket is allowed only if the **client address is loopback**. `--host 0.0.0.0` may still serve the map on a LAN; non-loopback clients do not get a shell. No confirm-prompt or repo config that can default PTY-on later.
3. **`snowshoe map view`** GETs `{url}/api/view/{id}` using `SNOWSHOE_MAP_URL` + `SNOWSHOE_VIEW` (or `--url` / `--id`). Not ledger. Not `.snowshoe/`. Skill routing: [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md) (`learn.md` uses this CLI).
4. **Learning product** (quiz/verify) remains unshipped. The PTY may print a **human** welcome that invites starting the operator’s own agent and loading the snowshoe skill to discuss/study the map. Env **`SNOWSHOE_MODE=learn`** is a hint for that external agent (with `SNOWSHOE_MAP_URL` / `SNOWSHOE_VIEW`). Snowshoe still does not spawn an agent or send prompts.
5. **Session survives WS drops.** The shell is keyed by map `viewId` inside `map serve`. Closing the WebSocket (laptop sleep, brief network blip, tab backgrounding) **detaches** but does not kill the process; the UI auto-reconnects and replays a short output buffer. **Restart** (UI) or `?reset=1` destroys the server-side session and spawns a new shell. Orphans are bounded: idle detached sessions are reaped after **12h**, and at most **4** shells exist per `map serve` (evict oldest detached first when spawning another). Stopping `map serve` still ends all PTYs.

## Alternatives considered

- In-UI chat / multi-backend harness — rejected (product form).
- Git hooks for focus — rejected (pull signal, not map clicks).
- Gate PTY on HTTP bind address — rejected (`--host` experiments would expose a shell).
- Agent-driven selection — rejected (HITL).
- Kill shell on every WS close — rejected; laptop sleep made agent sessions unusable.
- External tmux requirement — deferred; in-process persistence is enough for sleep/reconnect.

## Consequences

- CURRENT: togglable map sidebar; Terminal tab is a loopback PTY with a welcome banner and `SNOWSHOE_MODE=learn`; session persists across WS disconnect with UI auto-reconnect / Restart; `map view` re-reads focus. Still no quiz/verify.
- UI never writes the ledger from the PTY.

## Evidence

- [../notes/ui-ledger-split.md](../notes/ui-ledger-split.md)
