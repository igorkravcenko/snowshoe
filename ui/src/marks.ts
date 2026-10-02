import type { MapNode } from "./api.ts";

export const MARK_KINDS = ["detail", "expand", "enrich", "fix", "learn", "quiz"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

/** Personal flags only — not `work next`. Shown on the left-column Todos tab. */
export const HUMAN_TODO_KINDS = ["learn", "quiz"] as const;
export type HumanTodoKind = (typeof HUMAN_TODO_KINDS)[number];

export const MARK_LABELS: Record<MarkKind, string> = {
  detail: "Detail",
  expand: "Expand",
  enrich: "Enrich",
  fix: "Fix",
  learn: "Learn",
  quiz: "Quiz",
};

export function isHumanTodoKind(kind: string): kind is HumanTodoKind {
  return (HUMAN_TODO_KINDS as readonly string[]).includes(kind);
}

export type HumanTodoRow = {
  slug: string;
  title: string;
  kinds: HumanTodoKind[];
};

/** Nodes that carry at least one human todo mark (`learn` / `quiz`), stable slug order. */
export function humanTodoRows(nodes: Iterable<MapNode>): HumanTodoRow[] {
  const rows: HumanTodoRow[] = [];
  for (const node of nodes) {
    const kinds = (node.marks ?? []).filter(isHumanTodoKind);
    if (kinds.length === 0) continue;
    rows.push({
      slug: node.slug,
      title: node.title ?? node.slug,
      kinds: [...kinds].sort(),
    });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}
