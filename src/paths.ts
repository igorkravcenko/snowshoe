import { existsSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, EXIT_USAGE } from "./errors.ts";

/** Install / source root of the snowshoe package (skills/, ui/, package.json). */
export function snowshoePackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export const SNOWSHOE_DIR = ".snowshoe";
export const LEDGER_FILE = "ledger.sqlite";
export const MAP_NODES_DIR = join(SNOWSHOE_DIR, "map", "nodes");
export const EPOCHS_DIR = join(SNOWSHOE_DIR, "epochs");
export const ALLOWED_PROSE_PREFIX = `${SNOWSHOE_DIR}/map/`;

export function snowshoeDir(repoRoot: string): string {
  return join(repoRoot, SNOWSHOE_DIR);
}

export function ledgerPath(repoRoot: string): string {
  return join(repoRoot, SNOWSHOE_DIR, LEDGER_FILE);
}

export function mapNodesDir(repoRoot: string): string {
  return join(repoRoot, MAP_NODES_DIR);
}

export function epochDir(repoRoot: string, epochId: string): string {
  return join(repoRoot, EPOCHS_DIR, epochId);
}

export function epochArtifactRel(epochId: string, name: string): string {
  return `${EPOCHS_DIR}/${epochId}/${name}`.replaceAll("\\", "/");
}

/** Walk cwd → parents looking for a git toplevel; fall back to cwd. */
export function findRepoRoot(cwd = process.cwd()): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode === 0) {
    const top = result.stdout.toString().trim();
    if (top) return top;
  }
  return cwd;
}

export function requireRepoRoot(cwd = process.cwd()): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new CliError(
      "Not a git repository (or no .git). Run from a repo, or `snowshoe init` first.",
      EXIT_USAGE,
    );
  }
  return result.stdout.toString().trim();
}

export function isInitialized(repoRoot: string): boolean {
  return existsSync(ledgerPath(repoRoot));
}

/** Actionable hint for map UI / JSON APIs when `.snowshoe/` is missing. */
export const UNINITIALIZED_HINT =
  "Snowshoe is not initialized. Run `snowshoe init` (or use the snowshoe skill) first.";

export function requireInitialized(repoRoot: string): void {
  if (!isInitialized(repoRoot)) {
    throw new CliError(UNINITIALIZED_HINT, EXIT_USAGE);
  }
}

/** proseRef must stay under .snowshoe/map/ (no traversal). */
export function assertAllowedProseRef(repoRoot: string, proseRef: string): void {
  const normalized = proseRef.replaceAll("\\", "/");
  if (normalized.includes("\0") || normalized.startsWith("/")) {
    throw new CliError(`proseRef outside allowed root: ${proseRef}`, EXIT_USAGE);
  }
  if (!normalized.startsWith(ALLOWED_PROSE_PREFIX)) {
    throw new CliError(`proseRef outside allowed root: ${proseRef}`, EXIT_USAGE);
  }
  const abs = resolve(repoRoot, normalized);
  const allowed = resolve(repoRoot, SNOWSHOE_DIR, "map");
  const rel = relative(allowed, abs);
  if (rel.startsWith("..") || rel.startsWith(`..${sep}`) || normalize(rel) === "..") {
    throw new CliError(`proseRef outside allowed root: ${proseRef}`, EXIT_USAGE);
  }
}

export function anchorExists(repoRoot: string, path: string): boolean {
  if (path.includes("*") || path.includes("?")) return true;
  const abs = resolve(repoRoot, path);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith("..")) return false;
  return existsSync(abs);
}
