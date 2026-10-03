---
status: accepted
date: 2026-10-02
---

# ADR-2026-10-02: Apache-2.0 license

## Status

Accepted.

## Context

Monetization locks OSS / local core **free forever**
([ADR-2026-09-25-monetization-ladder](./ADR-2026-09-25-monetization-ladder.md))
but did not choose an SPDX license. The repo had no `LICENSE` file. Making the
repository public (or any third-party use) needs an explicit grant. Paid
convenience / optional commercial binary later must stay compatible with the
core license.

## Decision

- License the Snowshoe **product repository** under **Apache License 2.0**
  (SPDX: `Apache-2.0`).
- Ship the standard license text as root `LICENSE`.
- Keep a root `NOTICE` with copyright attribution for the project.
- `package.json` declares `"license": "Apache-2.0"`.

This covers source in this repo (CLI, map UI, in-repo skills that ship with the
product, docs). Maintainer-only private repos (e.g. `snowshoe-maintainers`) are
out of this ADR unless they adopt the same license separately.

## Alternatives considered

- **MIT** — simpler; no explicit patent grant. Rejected in favor of Apache-2.0
  patent language before public / possible commercial binary.
- **BSD-2/3** — similar to MIT; less familiar in npm tooling. Rejected.
- **GPL / AGPL** — copyleft fights the paid-convenience ladder and hosted
  forks. Rejected.
- **Source-available / BSL** — not OSS core as CURRENT claims. Rejected.
- **Dual-license day-1** — overhead with no need. Rejected.

## Consequences

- CURRENT states Apache-2.0 and points here.
- README surfaces the license.
- Does not implement billing, npm publish, or a commercial binary. Those stay
  future ADRs under the monetization ladder.
- Contributors and redistributors follow Apache-2.0 (including NOTICE retention
  when required).

## Evidence

None required beyond the SPDX / Apache License 2.0 text.
