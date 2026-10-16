---
status: accepted
date: 2026-10-16
---

# ADR-2026-10-16: Root `--help` is a human postcard

## Status

Accepted. Amends [ADR-2026-09-30-user-asked-mark-and-help](./ADR-2026-09-30-user-asked-mark-and-help.md) only for **root** `--help` / `-h` / no-args. Does **not** change `snowshoe help` / `help --json` (still the agent command index). Does **not** change subcommand `--help` (citty usage; `work complete --help` payload contract unchanged).

## Context

`snowshoe --help` and `snowshoe help` both printed the agent JSON index. Agents need that index (`help --json`). A human who types `snowshoe` or `--help` after install gets a wall of `audience: agent`. Issue #11 asked to make help human-readable; doing that to `help` itself would break agents that omit `--json`.

## Decision

1. **Human door:** `snowshoe` (no command), `snowshoe --help`, and `snowshoe -h` print a short plaintext usage postcard and exit 0. No ledger I/O.
2. **Agent door:** `snowshoe help` and `snowshoe help --json` stay the JSON command index. Root `--json` (no subcommand) also prints that index.
3. Subcommand `--help` is unchanged.

## Alternatives considered

- Human-readable default for `snowshoe help` — rejected; that name is the agent index.
- Keep root `--help` as JSON — rejected; that is the 5-second “is this a real CLI” surface.

## Consequences

CURRENT: root `--help` / no-args = human postcard; `help --json` remains the agent index. Skill install how-to verifies with `help --json`, not root `--help`.
