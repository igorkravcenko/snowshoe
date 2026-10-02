import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { rebaseAnchor } from "./anchor-rebase.ts";

export const MAX_FILE_BYTES = 1_000_000;

export class FileReadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FileReadError";
    this.status = status;
  }
}

export type FileReadResult = {
  ok: true;
  path: string;
  text: string;
  startLine?: number;
  endLine?: number;
  lineCount: number;
};

function looksAbsolute(rel: string): boolean {
  const n = rel.replaceAll("\\", "/");
  if (n.startsWith("/")) return true;
  if (/^[a-zA-Z]:/.test(n)) return true;
  return isAbsolute(rel);
}

function hasDotDotSegment(rel: string): boolean {
  return rel.replaceAll("\\", "/").split("/").includes("..");
}

function escapesRoot(root: string, abs: string): boolean {
  const rel = relative(root, abs);
  return rel === "" || rel.startsWith("..") || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/** Sandbox: requested path must stay under repoRoot. No `..`, no absolute, no symlink escape. */
export function resolveRepoFile(repoRoot: string, requested: string): { abs: string; rel: string } {
  const trimmed = requested.trim();
  if (!trimmed) {
    throw new FileReadError("Missing path", 400);
  }
  if (trimmed.includes("\0")) {
    throw new FileReadError("Invalid path", 400);
  }
  if (looksAbsolute(trimmed) || hasDotDotSegment(trimmed)) {
    throw new FileReadError("Path escapes repoRoot", 403);
  }

  const root = resolve(repoRoot);
  const abs = resolve(root, trimmed);
  if (escapesRoot(root, abs)) {
    throw new FileReadError("Path escapes repoRoot", 403);
  }
  const rel = relative(root, abs).replaceAll("\\", "/");
  return { abs, rel };
}

function parseLine(raw: number | undefined, name: string): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isInteger(raw) || raw < 1) {
    throw new FileReadError(`${name} must be a positive integer`, 400);
  }
  return raw;
}

function countLines(text: string): number {
  if (text === "") return 0;
  const parts = text.split(/\r?\n/);
  return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
}

export function readRepoFile(
  repoRoot: string,
  requested: string,
  range: { start?: number; end?: number; lineText?: string; span?: number } = {},
): FileReadResult {
  const { abs, rel } = resolveRepoFile(repoRoot, requested);
  if (!existsSync(abs)) {
    throw new FileReadError(`File not found: ${rel}`, 404);
  }

  const rootReal = realpathSync(repoRoot);
  let targetReal: string;
  try {
    targetReal = realpathSync(abs);
  } catch {
    throw new FileReadError(`File not found: ${rel}`, 404);
  }
  if (escapesRoot(rootReal, targetReal)) {
    throw new FileReadError("Path escapes repoRoot", 403);
  }

  const st = statSync(targetReal);
  if (!st.isFile()) {
    throw new FileReadError("Not a file", 400);
  }
  if (st.size > MAX_FILE_BYTES) {
    throw new FileReadError("File too large", 400);
  }

  const buf = readFileSync(targetReal);
  if (buf.includes(0)) {
    throw new FileReadError("Not a text file", 400);
  }
  const text = buf.toString("utf8");
  let startLine = parseLine(range.start, "start");
  let endLine = parseLine(range.end, "end");
  const span = parseLine(range.span, "span");
  if (range.lineText !== undefined && range.lineText.trim() !== "") {
    const derivedSpan =
      span ??
      (startLine !== undefined && endLine !== undefined && endLine >= startLine
        ? endLine - startLine + 1
        : null);
    const rebased = rebaseAnchor({
      fileText: text,
      storedStart: startLine,
      lineText: range.lineText,
      span: derivedSpan,
    });
    startLine = rebased.startLine ?? startLine;
    endLine =
      rebased.endLine ??
      (startLine !== undefined && derivedSpan ? startLine + derivedSpan - 1 : endLine);
  } else if (startLine !== undefined && span !== undefined) {
    endLine = startLine + span - 1;
  }
  if (startLine !== undefined && endLine !== undefined && startLine > endLine) {
    throw new FileReadError("start must be <= end", 400);
  }

  return {
    ok: true,
    path: rel,
    text,
    ...(startLine !== undefined ? { startLine } : {}),
    ...(endLine !== undefined ? { endLine } : {}),
    lineCount: countLines(text),
  };
}
