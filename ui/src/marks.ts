export const MARK_KINDS = ["detail", "enrich", "fix", "learn", "quiz"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export const MARK_LABELS: Record<MarkKind, string> = {
  detail: "Detail",
  enrich: "Enrich",
  fix: "Fix",
  learn: "Learn",
  quiz: "Quiz",
};
