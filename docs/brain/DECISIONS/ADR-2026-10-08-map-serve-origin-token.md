---
status: accepted
date: 2026-10-08
---

# ADR-2026-10-08: Map serve Origin + per-launch token (CSWSH / CSRF)

## Status

Accepted. Closes a P0 on published `@igorkravcenko/snowshoe@0.0.2`: browsers do not apply same-origin policy to WebSockets, so loopback peer + loopback `Host` were not enough to stop `new WebSocket("ws://127.0.0.1:3232/api/pty")` from a foreign website. Does **not** ship quiz/verify, hooks, or a public auth surface.

## Context

`snowshoe map serve` binds loopback and already rejected non-loopback `Host` (DNS rebinding). The map sidebar PTY is an interactive `$SHELL` with the user's environment. Cross-site pages can open a WebSocket to loopback; the `Origin` header is the attacker's site and was unchecked. HTTP POST/DELETE also parsed bodies regardless of `Content-Type`, which enables simple cross-site writes (ledger marks, feedback).

## Decision

1. **Origin (WebSocket `/api/pty`).** Reject the upgrade unless `Origin` is present and **exactly** one of `http://127.0.0.1:<port>`, `http://localhost:<port>`, `http://[::1]:<port>` for the **actually bound** port. Missing Origin is denied. The PTY is a browser map-UI channel; a non-browser client may send that same Origin string plus the token — no missing-Origin hatch.
2. **Per-launch token.** `map serve` generates a crypto-strong random secret (32-byte base64url) at start. The printed URL and `--open` URL put it in the **fragment** (`#t=<token>`). Fragments are not sent to the server; a cross-site page cannot read another origin's URL or `sessionStorage`. The UI reads the fragment, holds the token in memory + tab `sessionStorage`, then strips the fragment so `#slug` history still works. Require the token on **every** `/api/*` route (including `GET /api/file`) and on `/api/pty`. HTTP: `Authorization: Bearer`. PTY: `?t=` (browser `WebSocket()` cannot set headers). Compare with `crypto.timingSafeEqual`.
3. **Non-browser HTTP hatch.** `snowshoe map view` (PTY env) is not a browser and does not send `Origin`. Missing Origin on HTTP is allowed **only** with a valid token. Foreign Origin and `Sec-Fetch-Site: cross-site` are rejected even with a token. PTY env sets `SNOWSHOE_MAP_TOKEN`.
4. **Content-Type.** POST / PUT / PATCH (and DELETE with a body) require `Content-Type: application/json` (optional `; charset=…`). Form CSRF cannot set that plus the Bearer header.
5. Keep existing loopback bind, loopback peer (PTY), and loopback `Host` checks.

## Amendment 2026-10-08: HTML CSP + Referrer-Policy

HTML responses (`text/html`) send:

`default-src 'self'; connect-src 'self' ws://127.0.0.1:<port> ws://localhost:<port> ws://[::1]:<port>; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'`

`style-src 'self' 'unsafe-inline'` is required for Vite `/assets/*` CSS, React `style={{…}}` (column split, graph positions, Prism token colors), and **xterm** runtime `<style>` injection (theme, cell metrics, scrollbar). The 2026-10-08 first cut used only `style-src-attr 'unsafe-inline'`, which left style *elements* under `default-src 'self'` and broke sidebar PTY formatting — amended 2026-10-11. Scripts stay `'self'` via `default-src` (Vite emits `/assets/*` only). JSON `/api` keeps `frame-ancestors 'none'`. All responses send `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`. No CORS allow headers. Chrome may ignore `ws://[::1]:<port>` as a CSP host-source (IPv6 is outside the host-part grammar); `'self'` still covers same-origin `ws:` when the document is loaded on `[::1]`.

## Alternatives considered

- Origin-only, no token — rejected; non-browser clients and defense in depth.
- Cookie `SameSite=Strict` — rejected as the sole control; fragment token does not need a Set-Cookie on anonymous document load.
- Query-param token on HTTP — rejected (Referer / CSRF).
- Missing-Origin hatch on the PTY — rejected (default deny).

## Consequences

- CURRENT / `SECURITY.md` / README: map UI includes a terminal that runs the user's shell; stop the server when done; Origin + per-launch token.
- `--open` and the printed `url` remain one-click (`#t=`). Same-tab refresh keeps the token in `sessionStorage`; a new tab needs the printed URL (or a new `--open`).
- `map view` needs `SNOWSHOE_MAP_TOKEN` (set automatically in the map PTY).
- Version lockstep **0.0.3**. Do not publish from this change; the maintainer publishes.

## Evidence

None beyond the code and tests in this change.
