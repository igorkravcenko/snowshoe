import { CliError, EXIT_USAGE } from "../errors.ts";

export const MARK_KINDS = ["detail", "enrich", "fix", "learn", "quiz"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export const WORK_MARK_KINDS = ["detail", "enrich", "fix"] as const;
export type WorkMarkKind = (typeof WORK_MARK_KINDS)[number];

export function isMarkKind(raw: string): raw is MarkKind {
  return (MARK_KINDS as readonly string[]).includes(raw);
}

export function isWorkMarkKind(kind: string): kind is WorkMarkKind {
  return (WORK_MARK_KINDS as readonly string[]).includes(kind);
}

export function parseMarkKind(raw: unknown): MarkKind {
  if (typeof raw !== "string" || !isMarkKind(raw)) {
    throw new CliError(`Unknown mark kind (use ${MARK_KINDS.join(", ")})`, EXIT_USAGE);
  }
  return raw;
}
