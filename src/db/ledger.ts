import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type EntityType, type MetricLevel, ROOT_SLUG, type StepKind } from "../domain/types.ts";
import { ledgerPath, snowshoeDir } from "../paths.ts";

export type NodeRow = {
  slug: string;
  title: string;
  type: EntityType;
  leaf: number;
  prose_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type EdgeRow = {
  from_slug: string;
  to_slug: string;
  kind: string;
};

export type AnchorRow = {
  id: number;
  slug: string;
  path: string;
  symbol: string | null;
  start_line: number | null;
  end_line: number | null;
  unresolved: number;
};

export type MetricRow = {
  slug: string;
  level: string;
  value: number;
};

export type EpochRow = {
  epoch_id: string;
  base: string;
  target: string;
  status: string;
  created_at: string;
  superseded_by: string | null;
};

export type StepRow = {
  id: string;
  kind: StepKind;
  status: string;
  epoch_id: string | null;
  parent_slug: string | null;
  node_id: string | null;
  level: string | null;
  lease_token: string | null;
  lease_expires_at: number | null;
  created_at: string;
  updated_at: string;
  artifact_ref: string | null;
  prior_artifact_ref: string | null;
  blast_severity: string | null;
};

export type BlastNodeRow = {
  epoch_id: string;
  node_id: string;
  severity: string;
};

/** SQLite busy wait (ms). Must be set before other PRAGMAs on open. */
export const SQLITE_BUSY_TIMEOUT_MS = 5000;

export function isSqliteBusyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /database is locked|database table is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(message);
}

function sleepSync(ms: number): void {
  const buf = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buf, 0, 0, ms);
}

/** Retry a sync SQLite open/query when another process holds the ledger (map serve vs `--wait`). */
export function runWithSqliteBusyRetry<T>(fn: () => T, budgetMs = SQLITE_BUSY_TIMEOUT_MS * 2): T {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    try {
      return fn();
    } catch (err) {
      if (!isSqliteBusyError(err) || Date.now() >= deadline) throw err;
      sleepSync(40);
    }
  }
}

const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  leaf INTEGER NOT NULL DEFAULT 0,
  prose_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  from_slug TEXT NOT NULL,
  to_slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'parent',
  PRIMARY KEY (from_slug, to_slug, kind)
);

CREATE TABLE IF NOT EXISTS anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol TEXT,
  start_line INTEGER,
  end_line INTEGER,
  unresolved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metrics (
  slug TEXT NOT NULL,
  level TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (slug, level)
);

CREATE TABLE IF NOT EXISTS epochs (
  epoch_id TEXT PRIMARY KEY,
  base TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  superseded_by TEXT
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  epoch_id TEXT,
  parent_slug TEXT,
  node_id TEXT,
  level TEXT,
  lease_token TEXT,
  lease_expires_at INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  artifact_ref TEXT,
  prior_artifact_ref TEXT,
  blast_severity TEXT
);

CREATE TABLE IF NOT EXISTS blast_nodes (
  epoch_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  PRIMARY KEY (epoch_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_steps_status_kind ON steps (status, kind);
CREATE INDEX IF NOT EXISTS idx_steps_parent ON steps (parent_slug, kind, status);
CREATE INDEX IF NOT EXISTS idx_anchors_slug ON anchors (slug);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges (from_slug);
`;

export class Ledger {
  readonly db: Database;
  readonly repoRoot: string;

  constructor(repoRoot: string, filename = ledgerPath(repoRoot)) {
    this.repoRoot = repoRoot;
    mkdirSync(dirname(filename), { recursive: true });
    mkdirSync(snowshoeDir(repoRoot), { recursive: true });
    this.db = runWithSqliteBusyRetry(() => {
      const db = new Database(filename, { create: true });
      try {
        db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};`);
        db.exec("PRAGMA foreign_keys = ON;");
        const journal = db.query("PRAGMA journal_mode").get() as { journal_mode?: string } | null;
        if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") {
          db.exec("PRAGMA journal_mode = WAL;");
        }
        db.exec(MIGRATE_SQL);
        return db;
      } catch (err) {
        db.close();
        throw err;
      }
    });
  }

  close(): void {
    this.db.close();
  }

  now(): string {
    return new Date().toISOString();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  getMeta(key: string): string | null {
    const row = this.db.query("SELECT value FROM meta WHERE key = ?").get(key) as {
      value: string;
    } | null;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.run(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  nodeCount(): number {
    const row = this.db.query("SELECT COUNT(*) AS n FROM nodes").get() as { n: number };
    return row.n;
  }

  getNode(slug: string): NodeRow | null {
    return this.db.query("SELECT * FROM nodes WHERE slug = ?").get(slug) as NodeRow | null;
  }

  listNodes(): NodeRow[] {
    return this.db.query("SELECT * FROM nodes ORDER BY slug").all() as NodeRow[];
  }

  upsertNode(input: {
    slug: string;
    title: string;
    type: EntityType;
    leaf: boolean;
    proseRef?: string | null;
  }): void {
    const ts = this.now();
    this.db.run(
      `INSERT INTO nodes (slug, title, type, leaf, prose_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         type = excluded.type,
         leaf = excluded.leaf,
         prose_ref = excluded.prose_ref,
         updated_at = excluded.updated_at`,
      [input.slug, input.title, input.type, input.leaf ? 1 : 0, input.proseRef ?? null, ts, ts],
    );
  }

  deleteNode(slug: string): void {
    this.db.run("DELETE FROM anchors WHERE slug = ?", [slug]);
    this.db.run("DELETE FROM metrics WHERE slug = ?", [slug]);
    this.db.run("DELETE FROM edges WHERE from_slug = ? OR to_slug = ?", [slug, slug]);
    this.db.run("DELETE FROM nodes WHERE slug = ?", [slug]);
  }

  setEdge(from: string, to: string, kind = "parent"): void {
    this.db.run(
      "INSERT INTO edges (from_slug, to_slug, kind) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      [from, to, kind],
    );
  }

  clearEdge(from: string, to: string, kind = "parent"): void {
    this.db.run("DELETE FROM edges WHERE from_slug = ? AND to_slug = ? AND kind = ?", [
      from,
      to,
      kind,
    ]);
  }

  childrenOf(slug: string): string[] {
    const rows = this.db
      .query("SELECT to_slug FROM edges WHERE from_slug = ? AND kind = 'parent' ORDER BY to_slug")
      .all(slug) as { to_slug: string }[];
    return rows.map((r) => r.to_slug);
  }

  parentsOf(slug: string): string[] {
    const rows = this.db
      .query("SELECT from_slug FROM edges WHERE to_slug = ? AND kind = 'parent'")
      .all(slug) as { from_slug: string }[];
    return rows.map((r) => r.from_slug);
  }

  /** Outgoing non-parent (relevance) links from a node. */
  refsFrom(slug: string): Array<{ to: string; kind: string }> {
    const rows = this.db
      .query(
        "SELECT to_slug, kind FROM edges WHERE from_slug = ? AND kind != 'parent' ORDER BY to_slug, kind",
      )
      .all(slug) as { to_slug: string; kind: string }[];
    return rows.map((r) => ({ to: r.to_slug, kind: r.kind }));
  }

  replaceAnchors(
    slug: string,
    anchors: Array<{
      path: string;
      symbol?: string | null;
      startLine?: number | null;
      endLine?: number | null;
      unresolved?: boolean;
    }>,
  ): void {
    this.db.run("DELETE FROM anchors WHERE slug = ?", [slug]);
    for (const a of anchors) {
      this.db.run(
        `INSERT INTO anchors (slug, path, symbol, start_line, end_line, unresolved)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          slug,
          a.path,
          a.symbol ?? null,
          a.startLine ?? null,
          a.endLine ?? null,
          a.unresolved ? 1 : 0,
        ],
      );
    }
  }

  anchorsOf(slug: string): AnchorRow[] {
    return this.db.query("SELECT * FROM anchors WHERE slug = ?").all(slug) as AnchorRow[];
  }

  allAnchors(): AnchorRow[] {
    return this.db.query("SELECT * FROM anchors").all() as AnchorRow[];
  }

  unresolvedAnchorPaths(slug: string): string[] {
    const rows = this.db
      .query("SELECT path FROM anchors WHERE slug = ? AND unresolved = 1")
      .all(slug) as { path: string }[];
    return rows.map((r) => r.path);
  }

  setMetric(slug: string, level: MetricLevel, value: number): void {
    this.db.run(
      `INSERT INTO metrics (slug, level, value) VALUES (?, ?, ?)
       ON CONFLICT(slug, level) DO UPDATE SET value = excluded.value`,
      [slug, level, value],
    );
  }

  getMetric(slug: string, level: MetricLevel): number | null {
    const row = this.db
      .query("SELECT value FROM metrics WHERE slug = ? AND level = ?")
      .get(slug, level) as { value: number } | null;
    return row ? row.value : null;
  }

  metricsOf(slug: string): Record<string, number> {
    const rows = this.db
      .query("SELECT level, value FROM metrics WHERE slug = ?")
      .all(slug) as MetricRow[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.level] = r.value;
    return out;
  }

  seedZeroMetrics(slug: string): void {
    for (const level of ["overview", "contracts", "internals"] as const) {
      if (this.getMetric(slug, level) === null) this.setMetric(slug, level, 0.0);
    }
  }

  getOpenEpoch(): EpochRow | null {
    return this.db
      .query("SELECT * FROM epochs WHERE status = 'open' ORDER BY created_at DESC LIMIT 1")
      .get() as EpochRow | null;
  }

  getEpoch(epochId: string): EpochRow | null {
    return this.db.query("SELECT * FROM epochs WHERE epoch_id = ?").get(epochId) as EpochRow | null;
  }

  insertEpoch(row: { epochId: string; base: string; target: string; status?: string }): void {
    this.db.run(
      `INSERT INTO epochs (epoch_id, base, target, status, created_at, superseded_by)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [row.epochId, row.base, row.target, row.status ?? "open", this.now()],
    );
    this.setMeta("current_epoch_id", row.epochId);
  }

  supersedeEpoch(oldId: string, newId: string): void {
    this.db.run("UPDATE epochs SET status = 'superseded', superseded_by = ? WHERE epoch_id = ?", [
      newId,
      oldId,
    ]);
  }

  advanceEpoch(epochId: string, target: string): void {
    this.db.run("UPDATE epochs SET status = 'advanced' WHERE epoch_id = ?", [epochId]);
    this.setMeta("caught_up_base", target);
    this.setMeta("current_epoch_id", "");
  }

  caughtUpBase(): string | null {
    return this.getMeta("caught_up_base");
  }

  insertStep(row: {
    id: string;
    kind: StepKind;
    status?: string;
    epochId?: string | null;
    parentSlug?: string | null;
    nodeId?: string | null;
    level?: string | null;
    priorArtifactRef?: string | null;
    blastSeverity?: string | null;
  }): void {
    const ts = this.now();
    this.db.run(
      `INSERT INTO steps (
         id, kind, status, epoch_id, parent_slug, node_id, level,
         lease_token, lease_expires_at, created_at, updated_at,
         artifact_ref, prior_artifact_ref, blast_severity
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?)`,
      [
        row.id,
        row.kind,
        row.status ?? "pending",
        row.epochId ?? null,
        row.parentSlug ?? null,
        row.nodeId ?? null,
        row.level ?? null,
        ts,
        ts,
        row.priorArtifactRef ?? null,
        row.blastSeverity ?? null,
      ],
    );
  }

  getStep(id: string): StepRow | null {
    return this.db.query("SELECT * FROM steps WHERE id = ?").get(id) as StepRow | null;
  }

  listSteps(opts?: { epochId?: string; kinds?: StepKind[]; statuses?: string[] }): StepRow[] {
    let sql = "SELECT * FROM steps WHERE 1=1";
    const params: string[] = [];
    if (opts?.epochId) {
      sql += " AND epoch_id = ?";
      params.push(opts.epochId);
    }
    if (opts?.kinds?.length) {
      sql += ` AND kind IN (${opts.kinds.map(() => "?").join(",")})`;
      params.push(...opts.kinds);
    }
    if (opts?.statuses?.length) {
      sql += ` AND status IN (${opts.statuses.map(() => "?").join(",")})`;
      params.push(...opts.statuses);
    }
    sql += " ORDER BY created_at, id";
    return this.db.query(sql).all(...params) as StepRow[];
  }

  activeDetailFor(slug: string): StepRow | null {
    return this.db
      .query(
        `SELECT * FROM steps WHERE kind = 'detail' AND parent_slug = ?
         AND status IN ('pending', 'leased') ORDER BY created_at DESC LIMIT 1`,
      )
      .get(slug) as StepRow | null;
  }

  updateStep(
    id: string,
    patch: Partial<{
      status: string;
      leaseToken: string | null;
      leaseExpiresAt: number | null;
      artifactRef: string | null;
      priorArtifactRef: string | null;
      blastSeverity: string | null;
    }>,
  ): void {
    const current = this.getStep(id);
    if (!current) return;
    this.db.run(
      `UPDATE steps SET
         status = ?,
         lease_token = ?,
         lease_expires_at = ?,
         artifact_ref = ?,
         prior_artifact_ref = ?,
         blast_severity = ?,
         updated_at = ?
       WHERE id = ?`,
      [
        patch.status ?? current.status,
        patch.leaseToken === undefined ? current.lease_token : patch.leaseToken,
        patch.leaseExpiresAt === undefined ? current.lease_expires_at : patch.leaseExpiresAt,
        patch.artifactRef === undefined ? current.artifact_ref : patch.artifactRef,
        patch.priorArtifactRef === undefined ? current.prior_artifact_ref : patch.priorArtifactRef,
        patch.blastSeverity === undefined ? current.blast_severity : patch.blastSeverity,
        this.now(),
        id,
      ],
    );
  }

  insertBlastNode(epochId: string, nodeId: string, severity: string): void {
    this.db.run(
      `INSERT INTO blast_nodes (epoch_id, node_id, severity) VALUES (?, ?, ?)
       ON CONFLICT(epoch_id, node_id) DO UPDATE SET severity = excluded.severity`,
      [epochId, nodeId, severity],
    );
  }

  blastNodes(epochId: string): BlastNodeRow[] {
    return this.db
      .query("SELECT * FROM blast_nodes WHERE epoch_id = ?")
      .all(epochId) as BlastNodeRow[];
  }

  getBlastNode(epochId: string, nodeId: string): BlastNodeRow | null {
    return this.db
      .query("SELECT * FROM blast_nodes WHERE epoch_id = ? AND node_id = ?")
      .get(epochId, nodeId) as BlastNodeRow | null;
  }

  isEmpty(): boolean {
    return this.nodeCount() === 0;
  }

  ensureRoot(): boolean {
    if (this.getNode(ROOT_SLUG)) return false;
    this.upsertNode({
      slug: ROOT_SLUG,
      title: "Root",
      type: "system",
      leaf: false,
    });
    this.seedZeroMetrics(ROOT_SLUG);
    return true;
  }
}
