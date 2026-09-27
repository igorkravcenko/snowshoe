import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const CLI = join(import.meta.dir, "../src/index.ts");

export function makeGitRepo(prefix = "snowshoe-hp-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Snowshoe Test"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(dir, "README.md"), "# fixture\n");
  git(dir, ["add", "README.md"]);
  git(dir, ["commit", "-m", "init"]);
  return dir;
}

export function git(cwd: string, args: string[]): string {
  const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString()}`);
  }
  return r.stdout.toString().trim();
}

export function commitFile(
  cwd: string,
  relPath: string,
  contents: string,
  message: string,
): string {
  const abs = join(cwd, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
  git(cwd, ["add", relPath]);
  git(cwd, ["commit", "-m", message]);
  return git(cwd, ["rev-parse", "HEAD"]);
}

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  json: Record<string, unknown>;
};

export async function snowshoe(
  cwd: string,
  args: string[],
  opts: { stdin?: string } = {},
): Promise<CliResult> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    cwd,
    stdin: opts.stdin !== undefined ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (opts.stdin !== undefined) {
    const stdin = proc.stdin;
    if (!stdin) throw new Error("stdin not available");
    stdin.write(opts.stdin);
    stdin.end();
  }
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  let json: Record<string, unknown> = {};
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      json = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      json = { _raw: trimmed };
    }
  }
  return { exitCode, stdout, stderr, json };
}

export function readGitignore(cwd: string): string {
  return readFileSync(join(cwd, ".gitignore"), "utf8");
}

export function completeEnvelope(
  items: Array<{ id: string; leaseToken: string; kind: string; payload: unknown }>,
): string {
  return JSON.stringify({ schemaVersion: 1, completions: items });
}

export function detailPayload(args: {
  parentSlug: string;
  unchanged?: boolean;
  nodes?: Array<Record<string, unknown>>;
  children?: string[];
  refs?: Array<{ from: string; to: string; kind?: string }>;
}): Record<string, unknown> {
  const unchanged = args.unchanged ?? false;
  const nodes = (args.nodes ?? []).map((n) => {
    if (unchanged) return n;
    if (typeof n.body === "string" || typeof n.bodyMd === "string") return n;
    return { ...n, body: `Body for ${String(n.slug ?? "node")}` };
  });
  const children = args.children ?? (unchanged ? [] : nodes.map((n) => String(n.slug ?? "")));
  return {
    parentSlug: args.parentSlug,
    unchanged,
    nodes,
    children,
    refs: args.refs ?? [],
  };
}
