import { readFileSync } from "node:fs";
import { resolveRepoFile } from "./file-read.ts";

export function captureAnchorMeta(
  repoRoot: string,
  path: string,
  startLine?: number | null,
  endLine?: number | null,
): { lineText: string | null; span: number | null } {
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
  if (startLine !== undefined && startLine !== null && startLine >= 1) {
    try {
      const { abs } = resolveRepoFile(repoRoot, path);
      const text = readFileSync(abs, "utf8");
      const lines = text.replace(/\n$/, "").split(/\r?\n/);
      const line = lines[startLine - 1];
      if (line !== undefined) lineText = line.trim();
    } catch {
      lineText = null;
    }
  }
  return { lineText, span };
}
