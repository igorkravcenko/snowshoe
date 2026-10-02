import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ALLOWED_PROSE_PREFIX, assertAllowedProseRef } from "../paths.ts";

export function defaultProseRef(slug: string): string {
  return `${ALLOWED_PROSE_PREFIX}nodes/${slug}.md`.replaceAll("\\", "/");
}

export function inlineBody(node: { body?: string; bodyMd?: string }): string | undefined {
  if (typeof node.body === "string") return node.body;
  if (typeof node.bodyMd === "string") return node.bodyMd;
  return undefined;
}

/**
 * First non-empty paragraph of markdown: stop at a blank line or an ATX heading.
 * Used as the agent-facing overview slice of entity prose.
 */
export function firstParagraph(md: string): string {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const para: string[] = [];
  let started = false;
  for (const line of lines) {
    if (!started) {
      if (line.trim() === "") continue;
      if (/^#{1,6}\s/.test(line)) break;
      started = true;
      para.push(line);
      continue;
    }
    if (line.trim() === "" || /^#{1,6}\s/.test(line)) break;
    para.push(line);
  }
  return para.join("\n").trim();
}

export function readProseFile(repoRoot: string, proseRef: string): string | null {
  try {
    assertAllowedProseRef(repoRoot, proseRef);
  } catch {
    return null;
  }
  const abs = join(repoRoot, proseRef.replaceAll("\\", "/"));
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

export function writeProseFile(repoRoot: string, proseRef: string, text: string): void {
  assertAllowedProseRef(repoRoot, proseRef);
  const abs = join(repoRoot, proseRef.replaceAll("\\", "/"));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, "utf8");
}
