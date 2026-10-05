import { readFileSync } from "node:fs";
import { resolveRepoFile } from "./file-read.ts";

export function captureAnchorMeta(
  repoRoot: string,
  path: string,
  startLine?: number | null,
  endLine?: number | null,
  locatorOffset: number = 0,
): { lineText: string | null; span: number | null; locatorLine: number | null } {
  let span: number | null = null;
  if (
    startLine !== undefined &&
    startLine !== null &&
    endLine !== undefined &&
    endLine !== null &&
    endLine >= startLine
  ) {
    span = endLine - startLine + 1;
  }
  let lineText: string | null = null;
  let locatorLine: number | null = null;
  if (startLine !== undefined && startLine !== null && startLine >= 1) {
    locatorLine = startLine + locatorOffset;
    try {
      const { abs } = resolveRepoFile(repoRoot, path);
      const text = readFileSync(abs, "utf8");
      const lines = text.replace(/\n$/, "").split(/\r?\n/);
      const line = lines[locatorLine - 1];
      if (line !== undefined) lineText = line.trim();
    } catch {
      lineText = null;
    }
  }
  return { lineText, span, locatorLine };
}

/** Reject reasons when startLine + locatorOffset is outside the fragment or file. */
export function anchorLocatorReasons(
  repoRoot: string,
  slug: string,
  anchor: {
    path: string;
    startLine?: number;
    endLine?: number;
    locatorOffset: number;
  },
): string[] {
  const reasons: string[] = [];
  if (anchor.startLine === undefined) return reasons;
  const locatorLine = anchor.startLine + anchor.locatorOffset;
  if (anchor.endLine !== undefined && locatorLine > anchor.endLine) {
    reasons.push(`anchor_locator_past_end:${slug}:${anchor.path}`);
  }
  try {
    const { abs } = resolveRepoFile(repoRoot, anchor.path);
    const text = readFileSync(abs, "utf8");
    const lines = text.replace(/\n$/, "").split(/\r?\n/);
    if (locatorLine < 1 || locatorLine > lines.length) {
      reasons.push(`anchor_locator_past_eof:${slug}:${anchor.path}`);
    }
  } catch {
    /* missing path handled separately as anchor_missing */
  }
  return reasons;
}
