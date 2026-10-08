---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Tryable map UI + skill (no learning)

## Status

Accepted. Authorizes a local map HTTP UI and an agent-loadable skill so a human can try the chained E2E in [../notes/e2e-happy-path-no-learning.md](../notes/e2e-happy-path-no-learning.md). Does **not** promote proposed routine ADRs A/B. Does **not** make the map the product home. 2026-09-30: `map status` default columns are `slug`+`children`; `--all-fields` / `?allFields=1` is the full row; `--slug` alone is that node; `--depth` is a subtree (from focus or `root`); `--neighborhood` is exclusive of `--depth`.

## Context

[ADR-2026-09-26-vertical-slice-cli](./ADR-2026-09-26-vertical-slice-cli.md) shipped the HP1–4 CLI. The stack ADR already points at React + Vite + local HTTP for `snowshoe map`, as a later face of the same util. The E2E note defines tryable as: init → skill drain → open map UI → walk → mark → drain → reload → open leaf via anchors → optional HEAD move → refresh/epoch/advance → reload.

UI ↔ ledger split: UI never opens SQLite, never writes the ledger, never calls `work complete`. Skill is an external agent loop; util does not spawn.

## Decision

Ship, in this slice:

1. **`snowshoe map serve`** — tiny localhost HTTP server. `GET /api/map/status` and `POST /api/map/detail/mark|cancel` are twins of the existing CLI commands and call the **same** `runMapStatus` / `runMapDetailMark` / `runMapDetailCancel` functions. Optional query on status: `fields` (comma-separated node keys; omit = `slug,children`), `allFields` / `all-fields` (every column; not with `fields`), `slug`, `depth`, `neighborhood` (same as CLI). The map UI fetches `GET /api/map/status?allFields=1`. Optional `GET /api/session` exposes `repoRoot` / `gitHead` / `locale` for the UI (editor links + tree start depth), plus `expandDepth` from `--expand-depth` (not the map read-model). **Mapped repo** is cwd (`repoRoot`). **UI files** are `ui/dist` of the *running* snowshoe package (`packageRoot` / bun-link target), not cwd. `bun link` is one global pointer; a second git worktree of Snowshoe does not get that worktree’s UI unless you `bun link` there or run `bun src/index.ts map serve` from it. Missing `/assets/*.js` and `/src/*` return 404 (never `index.html` as JavaScript).
2. **Map UI** — React + Vite, tree-first, static assets served by that HTTP server. Tree / inspector / sidebar column widths are drag-resizable (tab `sessionStorage` only, not the ledger). Float→color/bands computed **in the UI** using ADR-A display thresholds. Chrome is header (epoch **target** SHA, or git HEAD if no epoch yet; **Reload**) + parent-chain breadcrumbs + tree + inspector + optional preview — **no** API/CLI legend footer. `GET /api/session` includes `mapAnchor` (open epoch `target`, else `caught_up_base`) and `refreshRequired` (same rule as `work next`). The SHA is red when HEAD has moved; tooltip names the live HEAD and that catch-up is `routine refresh` / `snowshoe work next`. The UI does not run refresh. Selection is in the URL hash (`#slug`); Back/Forward are the browser history (not tree ← collapse). `POST /api/view` / `GET|PUT /api/view/:id` is an in-memory mirror of the focused slug for a tab (`?v=` in the URL). It is **not** the ledger, **not** `GET /api/session`, dies when `map serve` stops, and is **not** part of the drain skill (not an agent HITL control plane). PUT is UI→server only. Togglable right sidebar: Terminal (loopback PTY) first, Code preview second, Feedback third (dev inbox: `GET`/`POST`/`DELETE /api/feedback` twins of `snowshoe feedback list|add|remove`; UI can add and delete; not HITL). [ADR-2026-09-30-agent-feedback-inbox](./ADR-2026-09-30-agent-feedback-inbox.md). `snowshoe map view` re-reads RAM focus. PTY is allowed only for loopback **peers** (not “HTTP bind is localhost”). The UI does not send prompts to an agent. [ADR-2026-09-29-map-pty-channel](./ADR-2026-09-29-map-pty-channel.md). The tree is collapsible. `snowshoe map serve --expand-depth` (default **1**) is how many levels start expanded: depth 0 is the root, so default 1 expands root (first child row visible) and leaves deeper nodes collapsed. `GET /api/session` includes that integer. Chevron toggles persist in the page until reload of the tab; Reload after skill work does not re-seed. Single click selects; double-click expands or collapses children (same as the chevron). Arrow keys walk visible rows (↑/↓, Home/End); → expands or moves to the first child; ← collapses or moves to the parent. Keys apply to the tree without a prior click (except when focus is in the code preview). First load focuses the selected row. Navigating a `refs` link expands ancestors so the target is visible. Code open: in-UI preview plus secondary `vscode://file…` from `anchors[]` ([ADR-2026-09-27-locale-body-preview](./ADR-2026-09-27-locale-body-preview.md)). Inspector lists `refs` and navigates by selecting the other node. The UI may **poll** `GET /api/map/status?allFields=1` (and session) and highlight Reload when the fingerprint of that JSON (excluding wall-clock `generatedAt`) differs from the shown snapshot. HEAD leaving the epoch target is the red SHA, not Reload. It does **not** auto-replace the tree. Util does not launch an editor. Util does not push events; the UI infers change by re-reading.
3. **Skill package** at `skills/snowshoe/` (Cursor: symlink `.cursor/skills/snowshoe`) — thin `SKILL.md` gate, `drain.md`, `learn.md`, sibling `install.md` for an external agent. Util does not spawn, watch, or install hooks. Path detail: [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md) amendment 2026-10-03.

Skill contract (gate + PATH `snowshoe`, `work next` gating, default `--batch-size` 5, `install.md` only if missing): [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Detail payload `children` + `refs` and hard-reject unresolved anchors: [ADR-2026-09-27-detail-children-refs](./ADR-2026-09-27-detail-children-refs.md).

`.snowshoe/**` stays gitignored / uncommitted. A/B stay **proposed**; this ADR must not be read as rewriting those bodies.

## Alternatives considered

- Separate Vite-only static host plus a second writer — rejected; one util layer.
- Nest / Next / Electron — already out of day-1 (stack ADR).
- Skill that shells into a util-spawned agent — rejected; Snowshoe does not spawn.
- Promoting A/B in the same change — rejected; still proposed.

## Consequences

- CURRENT implementation status includes a tryable local map UI + skill, still no learning/quiz/verify.
- Navigable map remains a **secondary** surface (surfaces ADR). This slice only makes that on-demand face runnable.
- Test runner stays `bun test`. UI smoke does not replace HP1–4 CLI tests.

## Amendment 2026-10-04: loopback-only bind + Host checks

`snowshoe map serve --host` accepts **loopback only** (`127.0.0.1`, `localhost`,
`::1`). No LAN / `0.0.0.0` hatch in this slice. PTY upgrade and **every** map
HTTP `/api/*` route require a **loopback `Host` header** (DNS-rebinding
mitigation: peer IP can still be loopback while `Host` is attacker-controlled).
Documented in `SECURITY.md`.

## Amendment 2026-10-08: Origin + per-launch token

Loopback `Host` remains. PTY and every `/api/*` also require a matching loopback Origin (PTY: Origin mandatory) and a per-launch access token. See [ADR-2026-10-08-map-serve-origin-token](./ADR-2026-10-08-map-serve-origin-token.md).

## Amendment 2026-10-07: Soft-init + default port 3232

`map serve` boots without `.snowshoe/`. Session/status return `initialized: false` + empty nodes + CTA; ledger mutations stay 4xx. Default bind port is **3232** (`--port` / `0` ephemeral unchanged). See [ADR-2026-10-07-soft-init-combined-port](./ADR-2026-10-07-soft-init-combined-port.md).

## Evidence

- [../notes/e2e-happy-path-no-learning.md](../notes/e2e-happy-path-no-learning.md)
- [../notes/ui-ledger-split.md](../notes/ui-ledger-split.md)
- [../notes/skill-worker-contract.md](../notes/skill-worker-contract.md)
- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
