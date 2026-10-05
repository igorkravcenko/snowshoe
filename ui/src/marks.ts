import type { MapNode } from "./api.ts";

export const MARK_KINDS = [
  "detail",
  "expand",
  "enrich",
  "fix",
  "learn",
  "quiz",
  "new",
  "decayed",
] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

/** Kinds the human/agent may add from Mark menus (not system inbox). */
export const ADDABLE_MARK_KINDS = ["detail", "expand", "enrich", "fix", "learn", "quiz"] as const;
export type AddableMarkKind = (typeof ADDABLE_MARK_KINDS)[number];

/** System inbox notices — not `work next`. Cleared when leaving the node / Read all. */
export const INBOX_MARK_KINDS = ["new", "decayed"] as const;
export type InboxMarkKind = (typeof INBOX_MARK_KINDS)[number];

/** Personal flags only — not `work next`. Shown under Later on the Todos tab. */
export const HUMAN_TODO_KINDS = ["learn", "quiz"] as const;
export type HumanTodoKind = (typeof HUMAN_TODO_KINDS)[number];

export const MARK_LABELS: Record<MarkKind, string> = {
  detail: "Detail",
  expand: "Expand",
  enrich: "Enrich",
  fix: "Fix",
  learn: "Learn",
  quiz: "Quiz",
  new: "New",
  decayed: "Decayed",
};

/** Tooltip body: title · slug, then mark labels on their own line. */
export function formatNodeTip(title: string, slug: string, marks: readonly string[]): string {
  const head = title === slug ? slug : `${title} · ${slug}`;
  if (marks.length === 0) return head;
  const labels = marks.map((k) => MARK_LABELS[k as MarkKind] ?? k).join(", ");
  return `${head}\n${labels}`;
}

export function isHumanTodoKind(kind: string): kind is HumanTodoKind {
  return (HUMAN_TODO_KINDS as readonly string[]).includes(kind);
}

export function isInboxMarkKind(kind: string): kind is InboxMarkKind {
  return (INBOX_MARK_KINDS as readonly string[]).includes(kind);
}

export type MarkListRow = {
  slug: string;
  title: string;
  kinds: Array<InboxMarkKind | HumanTodoKind>;
};

function rowsFor(nodes: Iterable<MapNode>, pred: (kind: string) => boolean): MarkListRow[] {
  const rows: MarkListRow[] = [];
  for (const node of nodes) {
    const kinds = (node.marks ?? []).filter(pred) as Array<InboxMarkKind | HumanTodoKind>;
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

/** Inbox: system `new` / `decayed`. */
export function inboxTodoRows(nodes: Iterable<MapNode>): MarkListRow[] {
  return rowsFor(nodes, isInboxMarkKind);
}

/** Later: personal `learn` / `quiz`. */
export function humanTodoRows(nodes: Iterable<MapNode>): MarkListRow[] {
  return rowsFor(nodes, isHumanTodoKind);
}
