import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { Ledger } from "../db/ledger.ts";
import { ROOT_SLUG } from "../domain/types.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import {
  EPOCHS_DIR,
  MAP_NODES_DIR,
  findRepoRoot,
  ledgerPath,
  snowshoeDir,
} from "../paths.ts";
import { EXIT_OK } from "../errors.ts";

const GITIGNORE_BLOCK = `# Snowshoe personal ledger (local; do not commit)
.snowshoe/
`;

export function ensureGitignore(repoRoot: string): boolean {
  const gi = join(repoRoot, ".gitignore");
  if (!existsSync(gi)) {
    writeFileSync(gi, GITIGNORE_BLOCK, "utf8");
    return true;
  }
  const current = readFileSync(gi, "utf8");
  if (/(^|\n)\.snowshoe\/(\n|$)/.test(current)) return false;
  const prefix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
  appendFileSync(gi, `${prefix}\n${GITIGNORE_BLOCK}`);
  return true;
}

export function runInit(cwd = process.cwd()): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  mkdirSync(snowshoeDir(repoRoot), { recursive: true });
  mkdirSync(join(repoRoot, MAP_NODES_DIR), { recursive: true });
  mkdirSync(join(repoRoot, EPOCHS_DIR), { recursive: true });
  ensureGitignore(repoRoot);

  const ledger = new Ledger(repoRoot, ledgerPath(repoRoot));
  try {
    const empty = ledger.isEmpty();
    let seededDetail = false;
    if (empty) {
      ledger.ensureRoot();
      const existing = ledger.activeDetailFor(ROOT_SLUG);
      if (!existing) {
        ledger.insertStep({
          id: `detail:${ROOT_SLUG}`,
          kind: "detail",
          parentSlug: ROOT_SLUG,
        });
        seededDetail = true;
      }
    }
    const head = gitHead(repoRoot);
    if (head && !ledger.caughtUpBase()) {
      ledger.setMeta("caught_up_base", head);
    }
    const body = envelope("init", repoRoot, head, {
      ok: true,
      created: true,
      rootSlug: ROOT_SLUG,
      seededDetail: empty && seededDetail,
      emptyLedger: empty,
    });
    return { exitCode: EXIT_OK, body };
  } finally {
    ledger.close();
  }
}
