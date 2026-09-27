import { CliError, EXIT_INTERNAL } from "./errors.ts";

export function git(repoRoot: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const err = result.stderr.toString().trim();
    throw new CliError(
      `git ${args.join(" ")} failed: ${err || "unknown error"}`,
      EXIT_INTERNAL,
    );
  }
  return result.stdout.toString().trim();
}

export function gitOk(repoRoot: string, args: string[]): { ok: boolean; stdout: string } {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
  };
}

export function gitHead(repoRoot: string): string | null {
  const r = gitOk(repoRoot, ["rev-parse", "HEAD"]);
  return r.ok && r.stdout ? r.stdout : null;
}

export function gitDiffNames(repoRoot: string, base: string, target: string): string[] {
  if (base === target) return [];
  const stdout = git(repoRoot, ["diff", "--name-only", `${base}..${target}`]);
  if (!stdout) return [];
  return stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function gitCommitInRange(
  repoRoot: string,
  sha: string,
  base: string,
  target: string,
): boolean {
  const r = gitOk(repoRoot, ["merge-base", "--is-ancestor", sha, target]);
  if (!r.ok) return false;
  if (sha === base) return false;
  const notInBase = gitOk(repoRoot, ["merge-base", "--is-ancestor", sha, base]);
  if (notInBase.ok) {
    const full = gitOk(repoRoot, ["rev-parse", sha]);
    const baseFull = gitOk(repoRoot, ["rev-parse", base]);
    if (full.ok && baseFull.ok && full.stdout === baseFull.stdout) return false;
  }
  return true;
}

export function resolveGitRef(repoRoot: string, ref: string): string {
  return git(repoRoot, ["rev-parse", ref]);
}
