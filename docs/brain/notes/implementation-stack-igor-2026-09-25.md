---
status: note
date: 2026-09-25
---

# Note: Implementation stack + clarifications (Igor × Tech Lead, 2026-09-25)

Working memory. **Not truth.** Durable lock: [ADR-2026-09-25-implementation-stack.md](../DECISIONS/ADR-2026-09-25-implementation-stack.md). Hooks amendment: [ADR-2026-09-25-v1-surfaces.md](../DECISIONS/ADR-2026-09-25-v1-surfaces.md).

## Topic

1:1 locked the util stack and a few product facts that were easy to misread from CURRENT / surfaces as they stood.

## Stack (normative in the ADR)

TypeScript + Bun; `bun build --compile` (mac/linux first); citty default (commander ok); Zod (+ JSON Schema files later); `bun:sqlite` ledger under `.snowshoe/`; Vitest + golden FSM fixtures; later `snowshoe map` = tiny local HTTP + system browser, React + Vite, tree-first, bands display-only.

Out of day-1: NestJS, Next.js, Electron, Obsidian-plugin-as-home, Rust/Python/Go (Go considered, TS chosen).

Provisional binary `snowshoe`. Informal *snow* is not CLI.

## Clarifications vs prior canon (easy to miss)

1. **`init` does not install hooks.** Opt-in `hooks install` / `uninstall` (spelling provisional). Default signal = human or skill → CLI.
2. **Storage split:** SQLite (FSM / metrics / leases) vs epoch files (heavy payloads) vs markdown (notes for learning UI, not metrics/status truth).
3. **Learning** stays out of routine ADRs; same store later; does not block `base` advance. Proposed epoch ADR is untouched.

## Next

Leave this note as the 1:1 digest. Do not promote proposed routine ADRs from here. Do not start app scaffolding until CURRENT says we are past pre-code.
