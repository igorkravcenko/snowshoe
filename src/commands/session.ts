import { Ledger } from "../db/ledger.ts";
import { gitHead } from "../git.ts";
import { findRepoRoot, ledgerPath, requireInitialized } from "../paths.ts";

export type Session = {
  repoRoot: string;
  gitHead: string | null;
  ledger: Ledger;
};

export function openSession(cwd = process.cwd()): Session {
  const repoRoot = findRepoRoot(cwd);
  requireInitialized(repoRoot);
  return {
    repoRoot,
    gitHead: gitHead(repoRoot),
    ledger: new Ledger(repoRoot, ledgerPath(repoRoot)),
  };
}

export function withSession<T>(fn: (s: Session) => T, cwd = process.cwd()): T {
  const session = openSession(cwd);
  try {
    return fn(session);
  } finally {
    session.ledger.close();
  }
}
