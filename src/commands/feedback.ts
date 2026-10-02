import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CliError, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot, SNOWSHOE_DIR } from "../paths.ts";

export const FEEDBACK_MAX_TEXT = 8192;
export const FEEDBACK_REL_DIR = join(SNOWSHOE_DIR, "feedback");
export const FEEDBACK_LOG = "log.jsonl";

export type FeedbackEntry = {
  id: string;
  createdAt: string;
  text: string;
  command?: string;
};

function feedbackDir(repoRoot: string): string {
  return join(repoRoot, FEEDBACK_REL_DIR);
}

function feedbackLogPath(repoRoot: string): string {
  return join(feedbackDir(repoRoot), FEEDBACK_LOG);
}

function parseAddBody(raw: unknown): { text: string; command?: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CliError("Expected JSON object { text, command? }", EXIT_USAGE);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.text !== "string") {
    throw new CliError("feedback add requires string text", EXIT_USAGE);
  }
  const text = o.text.trim();
  if (!text) {
    throw new CliError("feedback text is empty", EXIT_USAGE);
  }
  if (text.length > FEEDBACK_MAX_TEXT) {
    throw new CliError(`feedback text exceeds ${FEEDBACK_MAX_TEXT} characters`, EXIT_USAGE);
  }
  let command: string | undefined;
  if (o.command !== undefined && o.command !== null) {
    if (typeof o.command !== "string") {
      throw new CliError("command must be a string", EXIT_USAGE);
    }
    const c = o.command.trim();
    if (c) command = c;
  }
  return command ? { text, command } : { text };
}

/** File order (oldest first). */
function readEntriesChronological(repoRoot: string): FeedbackEntry[] {
  const path = feedbackLogPath(repoRoot);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n");
  const out: FeedbackEntry[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t) as Partial<FeedbackEntry>;
      if (
        typeof row.id !== "string" ||
        typeof row.createdAt !== "string" ||
        typeof row.text !== "string"
      ) {
        continue;
      }
      const e: FeedbackEntry = { id: row.id, createdAt: row.createdAt, text: row.text };
      if (typeof row.command === "string" && row.command) e.command = row.command;
      out.push(e);
    } catch {
      /* skip corrupt line */
    }
  }
  return out;
}

function readEntries(repoRoot: string): FeedbackEntry[] {
  return readEntriesChronological(repoRoot).reverse();
}

function writeEntriesChronological(repoRoot: string, entries: FeedbackEntry[]): void {
  mkdirSync(feedbackDir(repoRoot), { recursive: true });
  const path = feedbackLogPath(repoRoot);
  if (entries.length === 0) {
    writeFileSync(path, "");
    return;
  }
  writeFileSync(path, `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`);
}

export function runFeedbackAdd(
  cwd: string,
  raw: unknown,
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const parsed = parseAddBody(raw);
  mkdirSync(feedbackDir(repoRoot), { recursive: true });
  const entry: FeedbackEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed,
  };
  appendFileSync(feedbackLogPath(repoRoot), `${JSON.stringify(entry)}\n`);
  return {
    exitCode: EXIT_OK,
    body: envelope("feedback.add", repoRoot, gitHead(repoRoot), { entry }),
  };
}

export function runFeedbackRemove(
  cwd: string,
  idRaw: string,
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const id = idRaw.trim();
  if (!id) {
    throw new CliError("feedback remove requires --id", EXIT_USAGE);
  }
  const chrono = readEntriesChronological(repoRoot);
  const next = chrono.filter((e) => e.id !== id);
  if (next.length === chrono.length) {
    throw new CliError(`Unknown feedback id: ${id}`, EXIT_USAGE);
  }
  writeEntriesChronological(repoRoot, next);
  return {
    exitCode: EXIT_OK,
    body: envelope("feedback.remove", repoRoot, gitHead(repoRoot), { removedId: id }),
  };
}

export function runFeedbackList(cwd: string): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  return {
    exitCode: EXIT_OK,
    body: envelope("feedback.list", repoRoot, gitHead(repoRoot), {
      entries: readEntries(repoRoot),
    }),
  };
}
