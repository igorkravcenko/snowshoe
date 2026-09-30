import { descendantSlugs } from "../domain/graph.ts";
import { isSlug, ROOT_SLUG } from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { envelope } from "../json.ts";
import { readProseFile } from "../map/prose.ts";
import type { Session } from "./session.ts";

export const MAP_STATUS_NODE_FIELDS = [
  "slug",
  "title",
  "type",
  "leaf",
  "detailStatus",
  "metrics",
  "anchors",
  "anchorsUnresolved",
  "proseRef",
  "bodyMd",
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
  }));
  const unresolved = session.ledger.unresolvedAnchorPaths(n.slug);
  return {
    slug: n.slug,
    title: n.title,
    type: n.type,
    leaf: n.leaf === 1 || n.type === "symbol",
    detailStatus: active ? (active.status === "leased" ? "leased" : "pending") : null,
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
    bodyMd: n.prose_ref ? (readProseFile(session.repoRoot, n.prose_ref) ?? null) : null,
    children: session.ledger.childrenOf(n.slug),
    refs: session.ledger.refsFrom(n.slug),
  };
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

export function runMapDetailMark(
  session: Session,
  slug: string,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const node = session.ledger.getNode(slug);
  if (!node) {
    throw new CliError(`Unknown slug: ${slug}`, EXIT_USAGE);
  }
  const existing = session.ledger.activeDetailFor(slug);
  if (existing) {
    return {
      exitCode: EXIT_OK,
      body: envelope("map.detail.mark", session.repoRoot, session.gitHead, {
        ok: true,
        slug,
        stepId: existing.id,
        alreadyQueued: true,
        status: existing.status,
      }),
    };
  }
  const stepId = `detail:${slug}`;
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
      kind: "detail",
      parentSlug: slug,
    });
  }
  return {
    exitCode: EXIT_OK,
    body: envelope("map.detail.mark", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      stepId,
      alreadyQueued: false,
      status: "pending",
    }),
  };
}

export function runMapDetailCancel(
  session: Session,
  slug: string,
): { exitCode: number; body: Record<string, unknown> } {
  if (!slug || !isSlug(slug)) {
    throw new CliError("Invalid --slug", EXIT_USAGE);
  }
  const existing = session.ledger.activeDetailFor(slug);
  if (!existing) {
    return {
      exitCode: EXIT_ATTENTION,
      body: envelope("map.detail.cancel", session.repoRoot, session.gitHead, {
        ok: false,
        slug,
        reasons: ["no_pending_detail"],
      }),
    };
  }
  if (existing.status !== "pending") {
    return {
      exitCode: EXIT_ATTENTION,
      body: envelope("map.detail.cancel", session.repoRoot, session.gitHead, {
        ok: false,
        slug,
        stepId: existing.id,
        reasons: ["cancel_only_from_pending"],
        status: existing.status,
      }),
    };
  }
  session.ledger.updateStep(existing.id, {
    status: "cancelled",
    leaseToken: null,
    leaseExpiresAt: null,
  });
  return {
    exitCode: EXIT_OK,
    body: envelope("map.detail.cancel", session.repoRoot, session.gitHead, {
      ok: true,
      slug,
      stepId: existing.id,
    }),
  };
}
