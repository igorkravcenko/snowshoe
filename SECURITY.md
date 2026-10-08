# Security

Snowshoe is a personal, local-first CLI and localhost map UI. Treat secrets as
out of git, and treat CI as the day-1 supply-chain tripwire.

## Reporting a vulnerability

Do **not** file a public GitHub issue for a security vulnerability.

1. Preferred: open a **private GitHub Security Advisory** on this repository
   (Security → Advisories → New draft security advisory).
2. If Advisories are unavailable: contact the repository owner via GitHub
   (do not paste tokens, keys, or `.env` contents in a public comment).

## Supported versions

Only the tip of `main` / unreleased `0.0.2` is supported for security fixes.
There is no older release train yet.

## In scope

- Local CLI (`snowshoe` / `snoe`) and personal `.snowshoe/` ledger on disk
- `snowshoe map serve` on **loopback bind only** (`127.0.0.1` / `localhost` / `::1`)
- Map PTY: loopback peer **and** loopback `Host` header
- All map HTTP `/api/*` routes: loopback `Host` header (mitigates DNS rebinding
  into shell, repo file read, and ledger read/write)
- Day-1 CI hygiene (frozen lockfile, SHA-pinned Actions)

## Out of scope (for now)

- Paid scanners, Dependabot/Snyk enterprise, SBOM theater
- Multi-tenant / hosted auth surfaces (not this product)
- Hook/husky installers as a security control
- Supply-chain guarantees beyond the free CI pins above

## What not to commit

Never commit:

- API tokens, GitHub PATs, cloud-agent secrets, or production credentials
- Steam keys or other license/serial material
- `.env` / `.env.*` files (and any file that is only a secret bag)
- Personal `.snowshoe/` ledger state (gitignored; local by default)

If a secret lands in git, rotate it. Do not assume a later delete is enough.

## Day-1 supply-chain hygiene

- Keep `bun.lock` committed.
- CI installs with `bun install --frozen-lockfile`.
- Pin GitHub Actions by **full commit SHA** (human tag in a comment).
- Review packages that run **install scripts** before adding them.
- See [ADR-2026-09-27-ci-supply-chain-hygiene](docs/brain/DECISIONS/ADR-2026-09-27-ci-supply-chain-hygiene.md).
