import { CliError, EXIT_USAGE } from "../errors.ts";
import { canonicalMapHop, type MapHopKind } from "./types.ts";

export const MARK_KINDS = ["expand", "enrich", "fix", "learn", "quiz"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export const WORK_MARK_KINDS = ["expand", "enrich", "fix"] as const;
export type WorkMarkKind = (typeof WORK_MARK_KINDS)[number];

export function isMarkKind(raw: string): raw is MarkKind {
  return (MARK_KINDS as readonly string[]).includes(raw);
}

export function isWorkMarkKind(kind: string): kind is WorkMarkKind {
  return (WORK_MARK_KINDS as readonly string[]).includes(kind);
}

/** `detail` is the old name for expand. */
export function parseMarkKind(raw: unknown): MarkKind {
  if (raw === "detail") return "expand";
  if (typeof raw !== "string" || !isMarkKind(raw)) {
    throw new CliError(`Unknown mark kind (use ${MARK_KINDS.join(", ")})`, EXIT_USAGE);
  }
  return raw;
}

export function workStepId(slug: string, kind: WorkMarkKind): string {
  return `${kind}:${slug}`;
}

export function hopFromStepKind(kind: string): MapHopKind {
  return canonicalMapHop(kind) ?? "expand";
}
