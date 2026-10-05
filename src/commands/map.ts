import { descendantSlugs } from "../domain/graph.ts";
import {
  isWorkMarkKind,
  type MarkKind,
  parseMarkKind,
  type WorkMarkKind,
  workStepId,
} from "../domain/marks.ts";
import { isSlug, METRIC_LEVELS, type MetricLevel, ROOT_SLUG } from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { envelope } from "../json.ts";
import { firstParagraph, readProseFile } from "../map/prose.ts";
import type { Session } from "./session.ts";

export const MAP_STATUS_NODE_FIELDS = [
  "slug",
  "title",
  "type",
  "leaf",
  "detailStatus",
  "marks",
  "metrics",
  "anchors",
  "anchorsUnresolved",
  "proseRef",
  "bodyMd",
  "bodyOverview",
  "children",
  "refs",
] as const;

export type MapStatusNodeField = (typeof MAP_STATUS_NODE_FIELDS)[number];

/** Default `--fields` when `--all-fields` is off. */
export const DEFAULT_MAP_STATUS_FIELDS: MapStatusNodeField[] = ["slug", "children"];

const NODE_FIELD_SET = new Set<string>(MAP_STATUS_NODE_FIELDS);

export type MapStatusOpts = {
  /** `null` = every column (`--all-fields`). Otherwise allowlist; `slug` is always kept. */
  fields?: string[] | null;
  slug?: string;
  depth?: number;
  neighborhood?: boolean;
};

function pickFields(
  row: Record<string, unknown>,
  fields: string[] | null,
): Record<string, unknown> {
  if (!fields) return row;
  const out: Record<string, unknown> = { slug: row.slug };
  for (const key of fields) {
    if (key === "slug") continue;
    if (key in row) out[key] = row[key];
  }
  return out;
}

function parseFields(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new CliError("--fields must be a non-empty comma-separated list", EXIT_USAGE);
  }
  const unknown = parts.filter((p) => !NODE_FIELD_SET.has(p));
  if (unknown.length) {
    throw new CliError(
      `Unknown --fields: ${unknown.join(", ")} (use comma-separated ${MAP_STATUS_NODE_FIELDS.join(", ")}; --all-fields for every column)`,
      EXIT_USAGE,
    );
  }
  return parts;
}

function fullNode(session: Session, slug: string): Record<string, unknown> | null {
  const n = session.ledger.getNode(slug);
  if (!n) return null;
  const active = session.ledger.activeDetailFor(n.slug);
  const metrics = session.ledger.metricsOf(n.slug);
  const hasMetrics = Object.keys(metrics).length > 0;
  const anchors = session.ledger.anchorsOf(n.slug).map((a) => ({
    path: a.path,
    ...(a.symbol ? { symbol: a.symbol } : {}),
    ...(a.start_line ? { startLine: a.start_line } : {}),
    ...(a.end_line ? { endLine: a.end_line } : {}),
    ...(a.line_text ? { lineText: a.line_text } : {}),
    ...(a.span ? { span: a.span } : {}),
    locatorOffset: a.locator_offset ?? 0,
  }));
  const unresolved = session.ledger.unresolvedAnchorPaths(n.slug);
  const marks = session.ledger.marksOfNormalized(n.slug);
  const bodyMd = n.prose_ref ? (readProseFile(session.repoRoot, n.prose_ref) ?? null) : null;
  const bodyOverview = bodyMd ? firstParagraph(bodyMd) || null : null;
  return {
    slug: n.slug,
    title: n.title,
    type: n.type,
    leaf: n.leaf === 1,
    detailStatus: active ? (active.status === "leased" ? "leased" : "pending") : null,
    marks,
    ...(hasMetrics
      ? {
          metrics: {
            ...(metrics.overview !== undefined ? { overview: metrics.overview } : {}),
            ...(metrics.contracts !== undefined ? { contracts: metrics.contracts } : {}),
            ...(metrics.internals !== undefined ? { internals: metrics.internals } : {}),
          },
        }
      : {}),
    anchors,
    ...(unresolved.length ? { anchorsUnresolved: unresolved } : {}),
    ...(n.prose_ref ? { proseRef: n.prose_ref } : {}),
    bodyMd,
    bodyOverview,
    children: session.ledger.childrenOf(n.slug),
    refs: session.ledger.refsFrom(n.slug),
  };
}

export function parseLeafFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  if (raw === undefined || raw === null || raw === "") {
    throw new CliError("Missing --leaf (true or false)", EXIT_USAGE);
  }
  const s = String(raw).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  throw new CliError("Invalid --leaf (true or false)", EXIT_USAGE);
}

function truthyFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false || raw === undefined || raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  if (s === "" || s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return true;
}

export function parseMapStatusOpts(args: {
  fields?: unknown;
  slug?: unknown;
  depth?: unknown;
  neighborhood?: unknown;
  allFields?: unknown;
}): MapStatusOpts {
  const allFields = truthyFlag(args.allFields);
  const fieldsRaw =
    args.fields === undefined || args.fields === null ? undefined : String(args.fields);
  if (allFields && fieldsRaw !== undefined) {
    throw new CliError("Do not combine --all-fields with --fields", EXIT_USAGE);
  }
  const fields = allFields
    ? null
    : fieldsRaw === undefined
      ? [...DEFAULT_MAP_STATUS_FIELDS]
      : parseFields(fieldsRaw);
  const slugRaw = args.slug === undefined || args.slug === "" ? undefined : String(args.slug);
  const neighborhood = truthyFlag(args.neighborhood);
  let depth: number | undefined;
  if (args.depth !== undefined && args.depth !== "" && args.depth !== null) {
    const n = Number(args.depth);
    if (!Number.isInteger(n) || n < 0) {
      throw new CliError("Invalid --depth (non-negative integer)", EXIT_USAGE);
    }
    depth = n;
  }
  if (neighborhood && !slugRaw) {
    throw new CliError("--neighborhood requires --slug", EXIT_USAGE);
  }
  if (neighborhood && depth !== undefined) {
    throw new CliError("Do not combine --depth with --neighborhood", EXIT_USAGE);
  }
  if (slugRaw && !isSlug(slugRaw)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  return { fields, slug: slugRaw, depth, neighborhood };
}

function statusFrame(
  session: Session,
  opts: {
    fields: string[] | null;
    focusSlug?: string;
    nodes: Record<string, unknown>[];
    neighborhood?: boolean;
    edges?: Array<{ from: string; to: string; kind: string }>;
  },
): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    rootSlug: ROOT_SLUG,
    locale: session.ledger.getMeta("locale"),
    ...(opts.neighborhood ? { neighborhood: true } : {}),
    ...(opts.fields ? { fields: opts.fields } : {}),
    ...(opts.focusSlug ? { focusSlug: opts.focusSlug } : {}),
    nodes: opts.nodes,
    ...(opts.edges ? { edges: opts.edges } : {}),
  };
}

function statusSlugs(session: Session, opts: MapStatusOpts): Set<string> {
  if (opts.slug) {
    return descendantSlugs(session.ledger, opts.slug, opts.depth ?? 0);
  }
  if (opts.depth !== undefined) {
    return descendantSlugs(session.ledger, ROOT_SLUG, opts.depth);
  }
  return new Set(session.ledger.listNodes().map((n) => n.slug));
}

function localGraph(
  session: Session,
  slug: string,
  fields: string[] | null,
): Record<string, unknown> {
  const edges: Array<{ from: string; to: string; kind: string }> = [];
  const slugs = new Set<string>([slug]);
  for (const p of session.ledger.parentsOf(slug)) {
    slugs.add(p);
    edges.push({ from: p, to: slug, kind: "parent" });
  }
  for (const c of session.ledger.childrenOf(slug)) {
    slugs.add(c);
    edges.push({ from: slug, to: c, kind: "parent" });
  }
  for (const r of session.ledger.refsFrom(slug)) {
    slugs.add(r.to);
    edges.push({ from: slug, to: r.to, kind: r.kind });
  }
  for (const r of session.ledger.refsTo(slug)) {
    slugs.add(r.from);
    edges.push({ from: r.from, to: slug, kind: r.kind });
  }
  const nodes = [...slugs]
    .sort()
    .map((s) => {
      const row = fullNode(session, s);
      if (!row) return null;
      return pickFields(row, fields);
    })
    .filter((n): n is Record<string, unknown> => n !== null);
  return statusFrame(session, {
    fields,
    focusSlug: slug,
    nodes,
    neighborhood: true,
    edges,
  });
}

export function runMapStatus(
  session: Session,
  opts: MapStatusOpts = {},
): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const fields = opts.fields === undefined ? [...DEFAULT_MAP_STATUS_FIELDS] : opts.fields;
  if (opts.slug && !session.ledger.getNode(opts.slug)) {
    throw new CliError(`Unknown slug: ${opts.slug}`, EXIT_USAGE);
  }
  if (opts.neighborhood) {
    return { exitCode: EXIT_OK, body: localGraph(session, opts.slug!, fields) };
  }

  const slugs = statusSlugs(session, opts);

  const nodes = [...slugs]
    .sort()
    .map((s) => fullNode(session, s))
    .filter((n): n is Record<string, unknown> => n !== null)
    .map((n) => pickFields(n, fields));

  return {
    exitCode: EXIT_OK,
    body: statusFrame(session, {
      fields,
      ...(opts.slug ? { focusSlug: opts.slug } : {}),
      nodes,
    }),
  };
}

function enqueueWorkStep(
  session: Session,
  slug: string,
  kind: WorkMarkKind,
): { stepId: string; alreadyQueued: boolean; status: string } {
  const existing = session.ledger.activeHopFor(slug, kind);
  if (existing) {
    return { stepId: existing.id, alreadyQueued: true, status: existing.status };
  }
  const stepId = workStepId(slug, kind);
  const prior = session.ledger.getStep(stepId);
  if (prior && (prior.status === "done" || prior.status === "cancelled")) {
    session.ledger.updateStep(stepId, {
      status: "pending",
      leaseToken: null,
      leaseExpiresAt: null,
    });
  } else if (!prior) {
    session.ledger.insertStep({
      id: stepId,
      kind,
      parentSlug: slug,
    });
  }
  return { stepId, alreadyQueued: false, status: "pending" };
}

function cancelPendingHop(
  session: Session,
  slug: string,
  kind: WorkMarkKind,
):
  | { ok: true; stepId: string }
  | { ok: false; reasons: string[]; stepId?: string; status?: string } {
  const existing = session.ledger.activeHopFor(slug, kind);
  if (!existing) {
    return { ok: false, reasons: ["no_pending_detail"] };
  }
  if (existing.status !== "pending") {
    return {
      ok: false,
      reasons: ["cancel_only_from_pending"],
      stepId: existing.id,
      status: existing.status,
    };
  }
  session.ledger.updateStep(existing.id, {
    status: "cancelled",
    leaseToken: null,
    leaseExpiresAt: null,
  });
  return { ok: true, stepId: existing.id };
}

export function runMapMark(
  session: Session,
  slug: string,
  kindRaw: unknown = "detail",
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const kind: MarkKind = parseMarkKind(kindRaw ?? "expand");
  const node = session.ledger.getNode(slug);
  if (!node) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  const added = session.ledger.addMark(slug, kind);
  let queued: { stepId: string; alreadyQueued: boolean; status: string } | undefined;
  if (isWorkMarkKind(kind)) {
    queued = enqueueWorkStep(session, slug, kind);
  }
  return {
    exitCode: EXIT_OK,
    body: envelope("map.mark", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      kind,
      alreadyMarked: !added,
      ...(queued
        ? { stepId: queued.stepId, alreadyQueued: queued.alreadyQueued, status: queued.status }
        : {}),
    }),
  };
}

export function runMapUnmark(
  session: Session,
  slug: string,
  kindRaw: unknown,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const kind: MarkKind = parseMarkKind(kindRaw);
  const node = session.ledger.getNode(slug);
  if (!node) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  const removed = session.ledger.removeMark(slug, kind);
  let cancelled: { stepId: string } | undefined;
  if (isWorkMarkKind(kind)) {
    const result = cancelPendingHop(session, slug, kind);
    if (result.ok) cancelled = { stepId: result.stepId };
  }
  return {
    exitCode: EXIT_OK,
    body: envelope("map.unmark", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      kind,
      removed,
      ...(cancelled ? { stepId: cancelled.stepId, status: "cancelled" } : {}),
    }),
  };
}

/** Clear system inbox marks (`new` / `decayed`) on one slug (leave-node / read). */
export function runMapInboxRead(
  session: Session,
  slug: string,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  if (!session.ledger.getNode(slug)) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  const cleared = session.ledger.clearInboxMarks(slug);
  return {
    exitCode: EXIT_OK,
    body: envelope("map.inbox.read", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      cleared,
    }),
  };
}

/** Clear all `new` / `decayed` marks in the ledger (Read all). */
export function runMapInboxReadAll(session: Session): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const cleared = session.ledger.clearAllInboxMarks();
  return {
    exitCode: EXIT_OK,
    body: envelope("map.inbox.readAll", session.repoRoot, session.gitHead, {
      ok: true,
      cleared,
    }),
  };
}

export function runMapSetLeaf(
  session: Session,
  slug: string,
  leaf: boolean,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const node = session.ledger.getNode(slug);
  if (!node) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  session.ledger.upsertNode({
    slug: node.slug,
    title: node.title,
    type: node.type,
    leaf,
    proseRef: node.prose_ref,
  });
  return {
    exitCode: EXIT_OK,
    body: envelope("map.leaf", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      leaf,
    }),
  };
}

function parseMetricFloat(raw: unknown, flag: string): number {
  if (raw === undefined || raw === null || raw === "") {
    throw new CliError(`Missing ${flag}`, EXIT_USAGE);
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new CliError(`${flag} must be a float in [0, 1]`, EXIT_USAGE);
  }
  return n;
}

/** When a child metric drops, pull parents down to min(parent, child) — never auto-raise. */
function decayParentsOnDrop(
  session: Session,
  childSlug: string,
  level: MetricLevel,
  childValue: number,
): void {
  for (const parent of session.ledger.parentsOf(childSlug)) {
    const current = session.ledger.getMetric(parent, level);
    if (current === null) continue;
    if (childValue < current) {
      session.ledger.setMetric(parent, level, childValue);
      session.ledger.noteMetricDrop(parent, current, childValue);
    }
  }
}

/**
 * Operator-facing metric write (personal comprehension). Not `metric_decay` / not `work next`.
 * Allows raise or lower in [0,1]. Lowering may min-decay ancestors for honesty.
 */
export function runMapMetric(
  session: Session,
  slug: string,
  updates: Partial<Record<MetricLevel, number>>,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const node = session.ledger.getNode(slug);
  if (!node) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  const levels = METRIC_LEVELS.filter((l) => updates[l] !== undefined);
  if (levels.length === 0) {
    throw new CliError(
      "Provide at least one of --overview, --contracts, --internals (float in [0, 1])",
      EXIT_USAGE,
    );
  }
  const before = session.ledger.metricsOf(slug);
  const applied: Array<{ level: MetricLevel; previous: number | null; value: number }> = [];
  session.ledger.transaction(() => {
    for (const level of levels) {
      const value = updates[level]!;
      const previous = session.ledger.getMetric(slug, level);
      session.ledger.setMetric(slug, level, value);
      session.ledger.noteMetricDrop(slug, previous, value);
      if (previous === null || value < previous) {
        decayParentsOnDrop(session, slug, level, value);
      }
      applied.push({ level, previous, value });
    }
  });
  return {
    exitCode: EXIT_OK,
    body: envelope("map.metric", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      before,
      after: session.ledger.metricsOf(slug),
      applied,
    }),
  };
}

export function parseMetricUpdates(args: {
  overview?: unknown;
  contracts?: unknown;
  internals?: unknown;
}): Partial<Record<MetricLevel, number>> {
  const out: Partial<Record<MetricLevel, number>> = {};
  for (const level of METRIC_LEVELS) {
    const raw = args[level];
    if (raw === undefined || raw === null || raw === "") continue;
    out[level] = parseMetricFloat(raw, `--${level}`);
  }
  return out;
}

/** Body or query twin for HTTP: { slug, overview?, contracts?, internals? }. */
export function metricUpdatesFromBody(
  body: Record<string, unknown>,
): Partial<Record<MetricLevel, number>> {
  const out: Partial<Record<MetricLevel, number>> = {};
  for (const level of METRIC_LEVELS) {
    if (!(level in body) || body[level] === undefined || body[level] === null) continue;
    out[level] = parseMetricFloat(body[level], level);
  }
  return out;
}

export function runMapDetailMark(
  session: Session,
  slug: string,
): { exitCode: number; body: Record<string, unknown> } {
  const result = runMapMark(session, slug, "detail");
  const {
    command: _command,
    schemaVersion: _schema,
    repoRoot: _root,
    gitHead: _head,
    ...rest
  } = result.body;
  return {
    exitCode: result.exitCode,
    body: envelope("map.detail.mark", session.repoRoot, session.gitHead, rest),
  };
}

export function runMapDetailCancel(
  session: Session,
  slug: string,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const cancelledIds: string[] = [];
  let leased: { stepId: string; status: string } | undefined;
  for (const kind of ["detail", "expand", "enrich", "fix"] as const) {
    const hop = session.ledger.activeHopFor(slug, kind);
    if (!hop) continue;
    if (hop.status !== "pending") {
      leased = { stepId: hop.id, status: hop.status };
      continue;
    }
    session.ledger.updateStep(hop.id, {
      status: "cancelled",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    cancelledIds.push(hop.id);
  }
  if (cancelledIds.length === 0) {
    return {
      exitCode: EXIT_ATTENTION,
      body: envelope("map.detail.cancel", session.repoRoot, session.gitHead, {
        ok: false,
        slug,
        ...(leased ? { stepId: leased.stepId, status: leased.status } : {}),
        reasons: [leased ? "cancel_only_from_pending" : "no_pending_detail"],
      }),
    };
  }
  session.ledger.clearWorkMarks(slug);
  return {
    exitCode: EXIT_OK,
    body: envelope("map.detail.cancel", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      stepId: cancelledIds[0],
    }),
  };
}
