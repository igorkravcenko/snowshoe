import { Ledger, runWithSqliteBusyRetry } from "../db/ledger.ts";
import { gitHead } from "../git.ts";
import { findRepoRoot, ledgerPath, requireInitialized } from "../paths.ts";

export type Session = {
  repoRoot: string;
  gitHead: string | null;
  ledger: Ledger;
};

/** SHA the map is bound to: open epoch target, else last advanced `caught_up_base`. */
export function mapEpochAnchor(session: Session): string | null {
  return session.ledger.getOpenEpoch()?.target ?? session.ledger.caughtUpBase();
}

/** Same rule as `work next` gating: HEAD left the map epoch target / caught-up base. */
export function refreshRequired(session: Session): boolean {
  const head = session.gitHead;
  if (!head) return false;
  const open = session.ledger.getOpenEpoch();
  if (open) return head !== open.target;
  const base = session.ledger.caughtUpBase();
  return Boolean(base && base !== head);
}

export function openSession(cwd = process.cwd()): Session {
  const repoRoot = findRepoRoot(cwd);
  requireInitialized(repoRoot);
  const head = gitHead(repoRoot);
  const ledger = runWithSqliteBusyRetry(() => new Ledger(repoRoot, ledgerPath(repoRoot)));
  return {
    repoRoot,
    gitHead: head,
    ledger,
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
