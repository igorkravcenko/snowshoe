# Contributing

Thanks for interest in Snowshoe. This is a small, spec-driven CLI. Please keep
changes aligned with shipped intent — do not invent product features in a PR.

## Ground rules

1. **Truth** is `docs/brain/CURRENT.md` plus accepted ADRs under
   `docs/brain/DECISIONS/`. Behavior or product-claim changes need an ADR **and**
   a CURRENT update in the same change.
2. Do **not** add learning/quiz/verify, default git-hook install, agent spawn,
   billing, or other surfaces unless CURRENT + an ADR already say so.
3. User-facing chat in this project is often Russian for maintainers; **repo
   docs, skills, commits, and PR text stay English.**
4. Security reports: see [`SECURITY.md`](./SECURITY.md) — not public issues.

## Dev setup

Requires [Bun](https://bun.sh) (`>=1.1`).

```bash
bun install --frozen-lockfile
bun link                  # PATH: snowshoe (+ snoe)
bun test
bun run typecheck
bun run check
```

Personal ledger lives under `.snowshoe/` (gitignored). `init` does not install
git hooks.

## Pull requests

- Keep the diff scoped to one intent.
- Include tests when changing CLI / map / skill behavior.
- Run `bun test`, `bun run typecheck`, and `bun run check` before asking for review.
- If you change brain docs, run `python3 scripts/ops/lint_brain_docs.py`.

License: Apache-2.0 (`LICENSE` + `NOTICE`).
