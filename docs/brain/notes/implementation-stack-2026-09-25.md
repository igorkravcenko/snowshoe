---
status: note
date: 2026-09-25
---

# Note: Implementation stack + clarifications (product owner × Tech Lead, 2026-09-25)

Working memory. **Not truth.** Durable lock: [ADR-2026-09-25-implementation-stack.md](../DECISIONS/ADR-2026-09-25-implementation-stack.md). Hooks amendment: [ADR-2026-09-25-v1-surfaces.md](../DECISIONS/ADR-2026-09-25-v1-surfaces.md).

## Topic

1:1 locked the util stack and a few product facts that were easy to misread from CURRENT / surfaces as they stood.

## Stack (normative in the ADR)

TypeScript + Bun; `bun build --compile` (mac/linux first); citty default (commander ok); Zod (+ JSON Schema files later); `bun:sqlite` ledger under `.snowshoe/`; Vitest + golden FSM fixtures; later `snowshoe map` = tiny local HTTP + system browser, React + Vite, tree-first, bands display-only.

Out of day-1: NestJS, Next.js, Electron, Obsidian-plugin-as-home, Rust/Python/Go (Go considered, TS chosen).

Provisional binary `snowshoe`. Informal *snow* is not CLI.

## Clarifications vs prior canon (easy to miss)

1. **`init` does not install hooks.** Default signal = skill → CLI (`snowshoe routine refresh` / `status` / `work`). Opt-in `hooks install` / `uninstall` (spelling provisional).
2. **Storage split:** SQLite is **SoT** for FSM / queue / leases / epoch meta / metrics floats `0.0–1.0`; epoch files at `.snowshoe/epochs/<epochId>/…`; markdown notes for learning UI are **not** SoT for metrics/statuses. Aligns with proposed routine A/B; does not promote them.
3. **Learning** stays out of routine ADRs; same store later; does not block `base` advance. Proposed epoch ADR is untouched.

CLI spelling is provisional `snowshoe …`. Informal *snow* is **not** a locked CLI name.

## Next

Leave this note as the 1:1 digest. Do not promote proposed routine ADRs from here. Do not start app scaffolding until CURRENT says we are past pre-code.
