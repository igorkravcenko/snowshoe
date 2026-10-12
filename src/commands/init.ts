import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Ledger, runWithSqliteBusyRetry } from "../db/ledger.ts";
import { parseLocaleInput } from "../domain/locale.ts";
import { ROOT_SLUG } from "../domain/types.ts";
import { EXIT_OK } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { EPOCHS_DIR, findRepoRoot, ledgerPath, MAP_NODES_DIR, snowshoeDir } from "../paths.ts";

const GITIGNORE_COMMENT = "# Snowshoe personal ledger at repo root (local; do not commit)";
/** Root-anchored: `/.snowshoe` matches a root symlink/file; `/.snowshoe/` a root dir. */
const GITIGNORE_PATTERNS = ["/.snowshoe", "/.snowshoe/"] as const;

const GITIGNORE_BLOCK = `${GITIGNORE_COMMENT}
${GITIGNORE_PATTERNS.join("\n")}
`;

function hasGitignoreLine(content: string, line: string): boolean {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\n)${escaped}(\\n|$)`).test(content);
}

/** Unanchored `.snowshoe` matches any directory named `.snowshoe`; rewrite to `/.snowshoe`. */
function migrateUnanchoredSnowshoeIgnore(content: string): string {
  return content
    .replaceAll(/(^|\n)\.snowshoe\/(?=\n|$)/g, "$1/.snowshoe/")
    .replaceAll(/(^|\n)\.snowshoe(?=\n|$)/g, "$1/.snowshoe");
}

export function ensureGitignore(repoRoot: string): boolean {
  const gi = join(repoRoot, ".gitignore");
  if (!existsSync(gi)) {
    writeFileSync(gi, GITIGNORE_BLOCK, "utf8");
    return true;
  }
  const current = readFileSync(gi, "utf8");
  const migrated = migrateUnanchoredSnowshoeIgnore(current);
  const missing = GITIGNORE_PATTERNS.filter((p) => !hasGitignoreLine(migrated, p));
  if (missing.length === 0) {
    if (migrated === current) return false;
    writeFileSync(gi, migrated, "utf8");
    return true;
  }
  const sep = migrated.length === 0 ? "" : migrated.endsWith("\n") ? "\n" : "\n\n";
  const addition =
    missing.length === GITIGNORE_PATTERNS.length && migrated === current
      ? GITIGNORE_BLOCK
      : `${missing.join("\n")}\n`;
  writeFileSync(gi, `${migrated}${sep}${addition}`, "utf8");
  return true;
}

export function runInit(
  cwd = process.cwd(),
  opts: { locale?: string | null; uiLanguage?: string | null } = {},
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  mkdirSync(snowshoeDir(repoRoot), { recursive: true });
  mkdirSync(join(repoRoot, MAP_NODES_DIR), { recursive: true });
  mkdirSync(join(repoRoot, EPOCHS_DIR), { recursive: true });
  ensureGitignore(repoRoot);

  const locale = parseLocaleInput({ locale: opts.locale, uiLanguage: opts.uiLanguage });

  const ledger = runWithSqliteBusyRetry(() => new Ledger(repoRoot, ledgerPath(repoRoot)));
  try {
    const empty = ledger.isEmpty();
    let seededDetail = false;
    if (empty) {
      ledger.ensureRoot();
      const existing = ledger.activeDetailFor(ROOT_SLUG);
      if (!existing) {
        ledger.insertStep({
          id: `expand:${ROOT_SLUG}`,
          kind: "expand",
          parentSlug: ROOT_SLUG,
        });
        ledger.addMark(ROOT_SLUG, "expand");
        seededDetail = true;
      }
    }
    if (locale) ledger.setMeta("locale", locale);
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
      locale: ledger.getMeta("locale"),
    });
    return { exitCode: EXIT_OK, body };
  } finally {
    ledger.close();
  }
}
