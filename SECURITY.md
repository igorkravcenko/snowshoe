# Security

Snowshoe is a personal, local-first CLI (and localhost map UI). Treat secrets as
out of git, and treat CI as the day-1 supply-chain tripwire.

## Reporting a vulnerability

Do **not** file a public GitHub issue for a security vulnerability.

Preferred: open a **private GitHub Security Advisory** on this repository
(Security → Advisories → New draft security advisory).

If advisories are unavailable (private indie repo / missing permission): contact
the owner via GitHub (do not paste tokens, keys, or `.env` contents in a public
comment).

## What not to commit

Never commit:

- API tokens, GitHub PATs, cloud-agent secrets, or production credentials
- Steam keys or other license/serial material
- `.env` / `.env.*` files (and any file that is only a secret bag)
- Personal `.snowshoe/` ledger state (gitignored; local by default)

If a secret lands in git, rotate it. Do not assume a later delete is enough.

## Day-1 supply-chain hygiene

- Keep `bun.lock` committed.
- CI installs with `bun install --frozen-lockfile` (immutable lock; no silent
  drift). See [ADR-2026-09-27-ci-supply-chain-hygiene](docs/brain/DECISIONS/ADR-2026-09-27-ci-supply-chain-hygiene.md).
- Pin GitHub Actions by **full commit SHA** (human tag in a comment). Bump
  Actions by changing the SHA on purpose, not by floating `@v4` / `@v2`.
- Review packages that run **install scripts** before adding them.
- `snowshoe map serve` binds **localhost** (`127.0.0.1`) by default. It is
  not a public auth surface. Embedded PTY/WebSocket is allowed only when the
  **peer address is loopback**, even if `--host` serves the map on a LAN.

## Out of scope (for now)

Paid scanners, Dependabot/Snyk enterprise, SBOM theater, and hook/husky
installers. Free/budget constraints; revisit with an ADR if that changes.
