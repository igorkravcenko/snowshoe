import { existsSync, watch } from "node:fs";
import { isSqliteBusyError, type StepRow } from "../db/ledger.ts";
import { descendantSlugs } from "../domain/graph.ts";
import { allowedChildTypes, childAllowed } from "../domain/matrix.ts";
import { requiredLevels, severityCap } from "../domain/metrics.ts";
import {
  type BlastSeverity,
  canonicalMapHop,
  DEFAULT_WORK_BATCH_SIZE,
  type EntityType,
  isEntityType,
  isMapHopKind,
  isSlug,
  LEASE_TTL_MS,
  type MetricLevel,
  ROOT_SLUG,
  ROUTINE_KINDS,
  type StepKind,
  WORK_NEXT_WAIT_FALLBACK_MS,
} from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitCommitInRange, gitDiffNames, gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { anchorLocatorReasons, captureAnchorMeta } from "../map/anchor-capture.ts";
import { defaultProseRef, inlineBody, readProseFile, writeProseFile } from "../map/prose.ts";
import {
  anchorExists,
  assertAllowedProseRef,
  findRepoRoot,
  isInitialized,
  snowshoeDir,
} from "../paths.ts";
import {
  blastPayloadSchema,
  completionsEnvelopeSchema,
  detailPayloadSchema,
  failuresEnvelopeSchema,
  type MetricPayload,
  metricPayloadSchema,
  type StructurePayload,
  stripDetailMetrics,
  structurePayloadSchema,
} from "../schemas/zod.ts";
import { canAdvance, writeArtifact } from "./routine.ts";
import { refreshRequired, type Session, withSession } from "./session.ts";

const KIND_PRIORITY: Record<StepKind, number> = {
  structure_sync: 0,
  blast_radius: 1,
  metric_decay: 2,
  expand: 3,
  detail: 3,
  enrich: 4,
  fix: 5,
};

function claimable(step: StepRow, now: number): boolean {
  if (step.status === "pending" || step.status === "failed") return true;
  if (step.status === "leased") {
    // Reclaim only when the lease is missing or past TTL. A still-valid
    // lease must stay with the current worker; overlapping `work next`
    // must not mint a new token.
    return !step.lease_expires_at || step.lease_expires_at <= now;
  }
  return false;
}

function requiredRoutinePending(session: Session): boolean {
  const open = session.ledger.getOpenEpoch();
  if (!open) return false;
  const steps = session.ledger.listSteps({
    epochId: open.epoch_id,
    kinds: [...ROUTINE_KINDS],
  });
  return steps.some((s) => s.status !== "accepted");
}

function structureAccepted(session: Session, epochId: string): boolean {
  const s = session.ledger.getStep(`structure:${epochId}`);
  return s?.status === "accepted";
}

function blastAccepted(session: Session, epochId: string): boolean {
  const s = session.ledger.getStep(`blast:${epochId}`);
  return s?.status === "accepted";
}

function dependenciesMet(session: Session, step: StepRow): boolean {
  if (step.kind === "blast_radius" && step.epoch_id) {
    return structureAccepted(session, step.epoch_id);
  }
  if (step.kind === "metric_decay" && step.epoch_id) {
    return blastAccepted(session, step.epoch_id);
  }
  if (isMapHopKind(step.kind)) {
    return !requiredRoutinePending(session);
  }
  return true;
}

export const WORK_NEXT_TODO = {
  init: "snowshoe init --json",
  refresh: "snowshoe routine refresh --json",
  advance: "snowshoe routine advance --json",
} as const;

export type WorkNextAction = "init" | "refresh" | "advance" | "work" | "idle";

function gatedNext(
  action: "init" | "refresh" | "advance",
  repoRoot: string,
  head: string | null,
  batchSize: number,
  locale: string | null = null,
): { exitCode: number; body: Record<string, unknown> } {
  return {
    exitCode: EXIT_OK,
    body: envelope("work.next", repoRoot, head, {
      action,
      todo: WORK_NEXT_TODO[action],
      items: [],
      stop: true,
      remaining: 0,
      batchSize,
      locale,
    }),
  };
}

function hasOpenWork(session: Session): boolean {
  return (
    session.ledger.listSteps({
      statuses: ["pending", "leased", "failed"],
    }).length > 0
  );
}

function isIdleNext(result: { body: Record<string, unknown> }): boolean {
  return result.body.action === "idle";
}

function withWaitTimedOut(result: { exitCode: number; body: Record<string, unknown> }): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  return { exitCode: result.exitCode, body: { ...result.body, waitTimedOut: true } };
}

/** Wake on `.snowshoe` changes (ledger + WAL). Fallback timer if watch is silent. */
export function waitForSnowshoeNudge(cwd: string, maxMs: number): Promise<void> {
  const dir = snowshoeDir(findRepoRoot(cwd));
  return new Promise((resolve) => {
    let settled = false;
    let watcher: ReturnType<typeof watch> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      try {
        watcher?.close();
      } catch {
        /* ignore */
      }
      resolve();
    };
    if (existsSync(dir)) {
      try {
        watcher = watch(dir, finish);
        watcher.on("error", finish);
      } catch {
        watcher = undefined;
      }
    }
    timer = setTimeout(finish, Math.max(0, maxMs));
  });
}

/** CLI entry: may run before `init` (returns a followable `todo` instead of failing). */
export function runWorkNextOnceFromCwd(
  opts: { batchSize?: number } = {},
  cwd = process.cwd(),
): { exitCode: number; body: Record<string, unknown> } {
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_WORK_BATCH_SIZE);
  const repoRoot = findRepoRoot(cwd);
  const head = gitHead(repoRoot);
  if (!isInitialized(repoRoot)) {
    return gatedNext("init", repoRoot, head, batchSize, null);
  }
  return withSession((session) => runWorkNext(session, { batchSize }), cwd);
}

export async function runWorkNextFromCwd(
  opts: { batchSize?: number; wait?: boolean; waitTimeoutMs?: number } = {},
  cwd = process.cwd(),
): Promise<{ exitCode: number; body: Record<string, unknown> }> {
  const wait = Boolean(opts.wait);
  const waitTimeoutMs = opts.waitTimeoutMs ?? 0;
  const started = Date.now();
  let result = runWorkNextOnceFromCwd({ batchSize: opts.batchSize }, cwd);
  if (!wait) return result;
  while (isIdleNext(result)) {
    if (waitTimeoutMs > 0 && Date.now() - started >= waitTimeoutMs) {
      return withWaitTimedOut(result);
    }
    const remaining =
      waitTimeoutMs > 0 ? waitTimeoutMs - (Date.now() - started) : WORK_NEXT_WAIT_FALLBACK_MS;
    if (waitTimeoutMs > 0 && remaining <= 0) {
      return withWaitTimedOut(result);
    }
    const sleepFor =
      waitTimeoutMs > 0
        ? Math.min(WORK_NEXT_WAIT_FALLBACK_MS, remaining)
        : WORK_NEXT_WAIT_FALLBACK_MS;
    await waitForSnowshoeNudge(cwd, sleepFor);
    try {
      result = runWorkNextOnceFromCwd({ batchSize: opts.batchSize }, cwd);
    } catch (err) {
      // Watch fires on WAL while map serve still holds the writer. Stay idle and wait again.
      if (!isSqliteBusyError(err)) throw err;
    }
  }
  return result;
}

export function runWorkNext(
  session: Session,
  opts: { batchSize?: number } = {},
): { exitCode: number; body: Record<string, unknown> } {
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_WORK_BATCH_SIZE);
  const locale = session.ledger.getMeta("locale");
  if (refreshRequired(session)) {
    return gatedNext("refresh", session.repoRoot, session.gitHead, batchSize, locale);
  }

  const now = Date.now();
  const open = session.ledger.getOpenEpoch();
  const all = session.ledger.listSteps({
    statuses: ["pending", "leased", "failed"],
  });
  const ranked = all
    .filter((s) => claimable(s, now) && dependenciesMet(session, s))
    .sort((a, b) => {
      const pk = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
      if (pk !== 0) return pk;
      return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    });

  const take = ranked.slice(0, batchSize);
  const items = session.ledger.transaction(() => {
    const out = [];
    for (const step of take) {
      const leaseToken = crypto.randomUUID();
      session.ledger.updateStep(step.id, {
        status: "leased",
        leaseToken,
        leaseExpiresAt: now + LEASE_TTL_MS,
      });
      out.push(
        formatWorkItem(
          session,
          { ...step, lease_token: leaseToken },
          open?.epoch_id ?? step.epoch_id,
        ),
      );
    }
    return out;
  });

  const remaining = Math.max(0, ranked.length - take.length);
  if (items.length > 0) {
    return {
      exitCode: EXIT_OK,
      body: envelope("work.next", session.repoRoot, session.gitHead, {
        action: "work",
        todo: null,
        items,
        stop: remaining === 0,
        remaining,
        batchSize,
        locale,
      }),
    };
  }
  if (hasOpenWork(session)) {
    return {
      exitCode: EXIT_OK,
      body: envelope("work.next", session.repoRoot, session.gitHead, {
        action: "work",
        todo: null,
        items: [],
        stop: remaining === 0,
        remaining,
        batchSize,
        locale,
      }),
    };
  }
  if (canAdvance(session).ok) {
    return gatedNext("advance", session.repoRoot, session.gitHead, batchSize, locale);
  }
  return {
    exitCode: EXIT_OK,
    body: envelope("work.next", session.repoRoot, session.gitHead, {
      action: "idle",
      todo: null,
      items: [],
      stop: true,
      remaining: 0,
      batchSize,
      locale,
    }),
  };
}

function stepKindsMatch(envelope: string, step: string): boolean {
  if (envelope === step) return true;
  // Legacy agents sent kind:detail for expand hops (detail used to alias expand).
  if (envelope === "detail" && step === "expand") return true;
  const a = canonicalMapHop(envelope);
  const b = canonicalMapHop(step);
  return a !== null && a === b;
}

function persistAnchors(
  session: Session,
  anchors: Array<{
    path: string;
    symbol?: string | null;
    startLine?: number;
    endLine?: number;
    locatorOffset: number;
  }>,
): Array<{
  path: string;
  symbol?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  lineText?: string | null;
  span?: number | null;
  locatorOffset?: number | null;
  unresolved: boolean;
}> {
  return anchors.map((a) => {
    const meta = captureAnchorMeta(
      session.repoRoot,
      a.path,
      a.startLine,
      a.endLine,
      a.locatorOffset,
    );
    return {
      path: a.path,
      symbol: a.symbol,
      startLine: a.startLine,
      endLine: a.endLine,
      lineText: meta.lineText,
      span: meta.span,
      locatorOffset: a.locatorOffset,
      unresolved: false,
    };
  });
}

function formatWorkItem(session: Session, step: StepRow, epochId: string | null) {
  const epoch = epochId ? session.ledger.getEpoch(epochId) : session.ledger.getOpenEpoch();
  const base = {
    stepId: step.id,
    kind: step.kind,
    leaseToken: step.lease_token,
    prior: step.prior_artifact_ref ? { artifactRef: step.prior_artifact_ref } : null,
  };
  if (isMapHopKind(step.kind)) {
    const hop = canonicalMapHop(step.kind) ?? "expand";
    const parent = step.parent_slug ? session.ledger.getNode(step.parent_slug) : null;
    const types =
      (hop === "expand" || hop === "detail") && parent ? allowedChildTypes(parent.type, false) : [];
    return {
      ...base,
      kind: hop,
      parentSlug: step.parent_slug,
      allowedChildTypes: types,
      children: step.parent_slug ? session.ledger.childrenOf(step.parent_slug) : [],
      intent: hop,
      marks: [hop],
    };
  }
  return {
    ...base,
    epochId: step.epoch_id,
    base: epoch?.base ?? null,
    target: epoch?.target ?? null,
    nodeId: step.node_id,
    level: step.level,
    blastSeverity: step.blast_severity,
  };
}

type CompleteResult = {
  id: string;
  status: "accepted" | "rejected";
  reasons?: string[];
};

export function runWorkComplete(
  session: Session,
  raw: unknown,
): { exitCode: number; body: Record<string, unknown> } {
  const parsed = completionsEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CliError(`Invalid complete envelope: ${parsed.error.message}`, EXIT_USAGE, {
      issues: parsed.error.issues,
    });
  }
  const results: CompleteResult[] = [];
  for (const item of parsed.data.completions) {
    results.push(
      completeOne(session, {
        id: item.id,
        leaseToken: item.leaseToken,
        kind: item.kind,
        payload: item.payload ?? {},
      }),
    );
  }
  const anyRejected = results.some((r) => r.status === "rejected");
  return {
    exitCode: anyRejected ? EXIT_ATTENTION : EXIT_OK,
    body: envelope("work.complete", session.repoRoot, session.gitHead, {
      ok: !anyRejected,
      results,
    }),
  };
}

function completeOne(
  session: Session,
  item: { id: string; leaseToken: string; kind?: StepKind; payload: unknown },
): CompleteResult {
  const step = session.ledger.getStep(item.id);
  if (!step) {
    return { id: item.id, status: "rejected", reasons: ["unknown_step"] };
  }
  if (item.kind && !stepKindsMatch(item.kind, step.kind)) {
    return { id: item.id, status: "rejected", reasons: ["kind_mismatch"] };
  }
  if (step.status === "accepted" || step.status === "done" || step.status === "cancelled") {
    return { id: item.id, status: "rejected", reasons: ["already_closed"] };
  }
  if (step.status !== "leased" || step.lease_token !== item.leaseToken) {
    return { id: item.id, status: "rejected", reasons: ["bad_lease"] };
  }
  if (step.lease_expires_at && step.lease_expires_at <= Date.now()) {
    session.ledger.updateStep(step.id, {
      status: "pending",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    return { id: item.id, status: "rejected", reasons: ["lease_expired"] };
  }

  try {
    switch (step.kind) {
      case "expand":
      case "enrich":
      case "fix":
      case "detail":
        return acceptDetail(session, step, item.payload);
      case "structure_sync":
        return acceptStructure(session, step, item.payload);
      case "blast_radius":
        return acceptBlast(session, step, item.payload);
      case "metric_decay":
        return acceptMetric(session, step, item.payload);
      default:
        return { id: step.id, status: "rejected", reasons: ["unknown_kind"] };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: step.id, status: "rejected", reasons: [msg] };
  }
}

function hasDeprecatedEdges(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && "edges" in raw);
}

function acceptDetail(session: Session, step: StepRow, rawPayload: unknown): CompleteResult {
  const stripped = stripDetailMetrics(rawPayload);
  if (hasDeprecatedEdges(stripped)) {
    return {
      id: step.id,
      status: "rejected",
      reasons: ["edges_removed: use children (parent→child) and refs (relevance)"],
    };
  }
  const parsed = detailPayloadSchema.safeParse(stripped);
  if (!parsed.success) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`invalid_payload: ${parsed.error.message}`],
    };
  }
  const payload = parsed.data;
  if (payload.parentSlug !== step.parent_slug) {
    return { id: step.id, status: "rejected", reasons: ["parent_slug_mismatch"] };
  }
  const parent = session.ledger.getNode(payload.parentSlug);
  if (!parent) {
    return { id: step.id, status: "rejected", reasons: ["unknown_parent"] };
  }

  const mutateEmpty =
    payload.nodes.length === 0 &&
    payload.children.length === 0 &&
    payload.refs.length === 0 &&
    payload.retire.length === 0 &&
    payload.clearEdges.length === 0;

  const hop = canonicalMapHop(step.kind) ?? "expand";

  if (payload.unchanged) {
    if (!mutateEmpty) {
      return { id: step.id, status: "rejected", reasons: ["unchanged_with_mutate"] };
    }
    session.ledger.updateStep(step.id, {
      status: "done",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    session.ledger.removeMark(payload.parentSlug, hop);
    return { id: step.id, status: "accepted" };
  }

  const reasons: string[] = [];
  if (hop === "enrich") {
    if (payload.children.length) reasons.push("enrich_forbids_children");
    if (payload.refs.length) reasons.push("enrich_forbids_refs");
    if (payload.retire.length) reasons.push("enrich_forbids_retire");
    if (payload.clearEdges.length) reasons.push("enrich_forbids_clear_edges");
    for (const node of payload.nodes) {
      if (node.slug !== payload.parentSlug) reasons.push(`enrich_only_parent:${node.slug}`);
    }
    if (payload.nodes.length === 0) reasons.push("enrich_requires_parent_upsert");
  }

  const hopSet = descendantSlugs(session.ledger, payload.parentSlug);
  const retireSet = new Set(payload.retire);
  for (const slug of payload.retire) {
    if (slug === ROOT_SLUG || slug === payload.parentSlug) {
      reasons.push(`cannot_retire:${slug}`);
      continue;
    }
    if (!session.ledger.getNode(slug)) {
      reasons.push(`unknown_retire:${slug}`);
      continue;
    }
    if (!hopSet.has(slug)) {
      reasons.push(`retire_outside_subtree:${slug}`);
    }
  }

  const newSlugs = new Set<string>();
  for (const node of payload.nodes) {
    if (node.slug === ROOT_SLUG) {
      reasons.push(`cannot_upsert_root:${node.slug}`);
    }
    if (retireSet.has(node.slug)) {
      reasons.push(`retire_and_upsert:${node.slug}`);
    }
    newSlugs.add(node.slug);
  }

  const known = new Set(session.ledger.listNodes().map((n) => n.slug));
  for (const slug of newSlugs) known.add(slug);

  const childSet = new Set(payload.children);
  const proseBySlug = new Map<string, string>();
  const proseWrites: Array<{ ref: string; text: string }> = [];
  for (const node of payload.nodes) {
    const isParent = node.slug === payload.parentSlug;
    if (!isParent && !childSet.has(node.slug)) {
      reasons.push(`missing_child:${node.slug}`);
    }
    if (isParent) {
      const remaining = new Set(
        session.ledger.childrenOf(payload.parentSlug).filter((c) => !retireSet.has(c)),
      );
      for (const extra of payload.children) remaining.add(extra);
      for (const childSlug of remaining) {
        const fromPayload = payload.nodes.find((n) => n.slug === childSlug);
        const ct = fromPayload?.type ?? session.ledger.getNode(childSlug)?.type;
        if (ct && !childAllowed(node.type, ct)) {
          reasons.push(`matrix_forbid:${node.type}->${ct}:${childSlug}`);
        }
      }
    } else if (!childAllowed(parent.type, node.type)) {
      reasons.push(`matrix_forbid:${parent.type}->${node.type}:${node.slug}`);
    }
    const inline = inlineBody(node);
    const trimmedInline = inline?.trim() ?? "";
    if (trimmedInline) {
      const ref = (node.proseRef ?? defaultProseRef(node.slug)).replaceAll("\\", "/");
      try {
        assertAllowedProseRef(session.repoRoot, ref);
        proseWrites.push({ ref, text: inline! });
        proseBySlug.set(node.slug, ref);
      } catch (e) {
        reasons.push(e instanceof Error ? e.message : String(e));
      }
    } else if (node.proseRef) {
      try {
        assertAllowedProseRef(session.repoRoot, node.proseRef);
        const existing = readProseFile(session.repoRoot, node.proseRef);
        if (!existing?.trim()) {
          reasons.push(`missing_body:${node.slug}`);
        } else {
          proseBySlug.set(node.slug, node.proseRef.replaceAll("\\", "/"));
        }
      } catch (e) {
        reasons.push(e instanceof Error ? e.message : String(e));
      }
    } else {
      reasons.push(`missing_body:${node.slug}`);
    }
    for (const anchor of node.anchors ?? []) {
      if (!anchorExists(session.repoRoot, anchor.path)) {
        reasons.push(`anchor_missing:${node.slug}:${anchor.path}`);
      } else {
        reasons.push(...anchorLocatorReasons(session.repoRoot, node.slug, anchor));
      }
    }
  }
  for (const child of payload.children) {
    if (child === payload.parentSlug || child === ROOT_SLUG) {
      reasons.push(`invalid_child:${child}`);
    }
    if (!known.has(child)) {
      reasons.push(`unknown_child:${child}`);
    }
  }
  for (const ref of payload.refs) {
    if ((ref.kind ?? "related") === "parent") {
      reasons.push(`ref_kind_parent_forbidden:${ref.from}->${ref.to}`);
    }
    if (!known.has(ref.from) || !known.has(ref.to)) {
      reasons.push(`unknown_ref_endpoint:${ref.from}->${ref.to}`);
    }
  }

  const currentChildren = new Set(session.ledger.childrenOf(payload.parentSlug));
  for (const edge of payload.clearEdges) {
    const kind = edge.kind ?? "related";
    if (kind === "parent") {
      if (edge.from !== payload.parentSlug || !currentChildren.has(edge.to)) {
        reasons.push(`clear_parent_edge_forbidden:${edge.from}->${edge.to}`);
      }
    } else if (!hopSet.has(edge.from) && !hopSet.has(edge.to)) {
      reasons.push(`clear_edge_outside_subtree:${edge.from}->${edge.to}`);
    }
  }

  if (reasons.length) {
    return { id: step.id, status: "rejected", reasons };
  }

  session.ledger.transaction(() => {
    for (const w of proseWrites) {
      writeProseFile(session.repoRoot, w.ref, w.text);
    }
    for (const node of payload.nodes) {
      const existed = session.ledger.getNode(node.slug);
      const leaf = Boolean(node.leaf);
      session.ledger.upsertNode({
        slug: node.slug,
        title: node.title ?? existed?.title ?? node.slug,
        type: node.type,
        leaf,
        proseRef: proseBySlug.get(node.slug) ?? node.proseRef ?? existed?.prose_ref ?? null,
      });
      if (!existed) session.ledger.seedZeroMetrics(node.slug);
      if (node.anchors)
        session.ledger.replaceAnchors(node.slug, persistAnchors(session, node.anchors));
    }
    for (const child of payload.children) {
      session.ledger.setEdge(payload.parentSlug, child, "parent");
    }
    for (const ref of payload.refs) {
      session.ledger.setEdge(ref.from, ref.to, ref.kind ?? "related");
    }
    for (const edge of payload.clearEdges) {
      session.ledger.clearEdge(edge.from, edge.to, edge.kind ?? "related");
    }
    for (const slug of payload.retire) {
      session.ledger.deleteNode(slug);
    }
    session.ledger.updateStep(step.id, {
      status: "done",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    session.ledger.removeMark(payload.parentSlug, hop);
  });

  return { id: step.id, status: "accepted" };
}

function resolveStructureSlug(
  node: StructurePayload["ops"][number] & { op: "upsert_node" },
): string | null {
  return node.node.slug ?? node.node.id ?? null;
}

function resolveStructureType(
  node: StructurePayload["ops"][number] & { op: "upsert_node" },
): EntityType | null {
  const t = node.node.type ?? node.node.kind;
  if (!t || !isEntityType(t)) return null;
  return t;
}

function acceptStructure(session: Session, step: StepRow, raw: unknown): CompleteResult {
  const parsed = structurePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`invalid_payload: ${parsed.error.message}`],
    };
  }
  const payload = parsed.data;
  const epoch = step.epoch_id ? session.ledger.getEpoch(step.epoch_id) : null;
  if (!epoch) return { id: step.id, status: "rejected", reasons: ["no_epoch"] };
  if (payload.base !== epoch.base || payload.target !== epoch.target) {
    return { id: step.id, status: "rejected", reasons: ["epoch_base_target_mismatch"] };
  }
  if (payload.ops.length === 0 && session.ledger.nodeCount() === 0) {
    return { id: step.id, status: "rejected", reasons: ["empty_ops_cold_start"] };
  }

  const reasons: string[] = [];
  const seenUpserts = new Set<string>();
  for (const op of payload.ops) {
    if (op.op === "upsert_node") {
      const slug = resolveStructureSlug(op);
      const type = resolveStructureType(op);
      if (!slug) reasons.push("upsert_missing_id");
      else if (!isSlug(slug)) reasons.push(`bad_slug:${slug}`);
      else if (seenUpserts.has(slug)) reasons.push(`duplicate_upsert:${slug}`);
      else seenUpserts.add(slug);
      if (slug && type === "system" && slug !== ROOT_SLUG) {
        reasons.push(`type_system_forbidden:${slug}`);
      }
      if (slug && !type && !session.ledger.getNode(slug)) {
        reasons.push(`upsert_missing_type:${slug}`);
      }
    }
  }
  for (const op of payload.ops) {
    if (op.op !== "upsert_node") continue;
    for (const parentId of op.node.parentIds ?? []) {
      if (!session.ledger.getNode(parentId) && !seenUpserts.has(parentId)) {
        reasons.push(`unresolved_parent:${parentId}`);
      }
    }
  }
  if (reasons.length) return { id: step.id, status: "rejected", reasons };

  const touched = gitDiffNames(session.repoRoot, epoch.base, epoch.target);
  const unmapped = new Set(payload.coverage?.unmappedPaths ?? []);
  const anchored = projectedAnchorPaths(session, payload);
  const uncovered = touched.filter((p) => {
    if (unmapped.has(p)) return false;
    return !anchored.some((a) => pathMatchesAnchor(p, a));
  });
  if (uncovered.length) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`coverage_unmapped:${uncovered.join(",")}`],
    };
  }

  const artifactRef = writeArtifact(session.repoRoot, epoch.epoch_id, "structure.json", payload);
  session.ledger.transaction(() => {
    applyStructureOps(session, payload, seenUpserts);
    session.ledger.updateStep(step.id, {
      status: "accepted",
      leaseToken: null,
      leaseExpiresAt: null,
      artifactRef,
    });
    session.ledger.setMeta(
      `structure_noop:${epoch.epoch_id}`,
      payload.ops.length === 0 ? "1" : "0",
    );
    session.ledger.setMeta(
      `structure_unmapped:${epoch.epoch_id}`,
      JSON.stringify(payload.coverage?.unmappedPaths ?? []),
    );
  });
  return { id: step.id, status: "accepted" };
}

/** Project post-ops anchor paths without writing the ledger (coverage gate). */
function projectedAnchorPaths(session: Session, payload: StructurePayload): string[] {
  const bySlug = new Map<string, string[]>();
  for (const a of session.ledger.allAnchors()) {
    const list = bySlug.get(a.slug) ?? [];
    list.push(a.path);
    bySlug.set(a.slug, list);
  }
  for (const op of payload.ops) {
    if (op.op === "upsert_node") {
      const slug = resolveStructureSlug(op);
      if (!slug) continue;
      if (op.node.codeAnchors) {
        bySlug.set(
          slug,
          op.node.codeAnchors.map((a) => a.path),
        );
      }
    } else if (op.op === "retire_node") {
      bySlug.delete(op.nodeId);
    }
  }
  return [...bySlug.values()].flat();
}

function applyStructureOps(
  session: Session,
  payload: StructurePayload,
  seenUpserts: Set<string>,
): void {
  for (const op of payload.ops) {
    if (op.op === "upsert_node") {
      const slug = resolveStructureSlug(op)!;
      const existing = session.ledger.getNode(slug);
      const type = resolveStructureType(op) ?? existing?.type ?? "module";
      const leaf = Boolean(op.node.leaf);
      session.ledger.upsertNode({
        slug,
        title: op.node.title ?? existing?.title ?? slug,
        type,
        leaf,
      });
      if (op.node.codeAnchors) {
        session.ledger.replaceAnchors(
          slug,
          persistAnchors(
            session,
            op.node.codeAnchors.map((a) => ({ ...a, locatorOffset: 0 })),
          ),
        );
      }
      for (const parentId of op.node.parentIds ?? []) {
        if (session.ledger.getNode(parentId) || seenUpserts.has(parentId)) {
          session.ledger.setEdge(parentId, slug, "parent");
        }
      }
    } else if (op.op === "retire_node") {
      session.ledger.deleteNode(op.nodeId);
    } else if (op.op === "set_edge") {
      session.ledger.setEdge(op.from, op.to, "parent");
    } else if (op.op === "clear_edge") {
      session.ledger.clearEdge(op.from, op.to, "parent");
    }
  }
}

function pathMatchesAnchor(path: string, anchor: string): boolean {
  const a = anchor.replaceAll("\\", "/");
  const p = path.replaceAll("\\", "/");
  if (a.endsWith("/**")) {
    const prefix = a.slice(0, -3).replace(/\/$/, "");
    return p === prefix || p.startsWith(`${prefix}/`);
  }
  if (a.endsWith("/*")) {
    const prefix = a.slice(0, -1);
    return p.startsWith(prefix) && !p.slice(prefix.length).includes("/");
  }
  if (a.includes("*")) {
    const re = new RegExp(`^${a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`);
    return re.test(p);
  }
  return p === a || p.startsWith(`${a}/`);
}

function acceptBlast(session: Session, step: StepRow, raw: unknown): CompleteResult {
  const parsed = blastPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`invalid_payload: ${parsed.error.message}`],
    };
  }
  const payload = parsed.data;
  const epoch = step.epoch_id ? session.ledger.getEpoch(step.epoch_id) : null;
  if (!epoch) return { id: step.id, status: "rejected", reasons: ["no_epoch"] };
  if (payload.base !== epoch.base || payload.target !== epoch.target) {
    return { id: step.id, status: "rejected", reasons: ["epoch_base_target_mismatch"] };
  }

  const reasons: string[] = [];
  const touched = gitDiffNames(session.repoRoot, epoch.base, epoch.target);
  const intersecting = session.ledger
    .allAnchors()
    .some((a) => touched.some((p) => pathMatchesAnchor(p, a.path)));
  if (payload.nodes.length === 0 && intersecting) {
    reasons.push("empty_blast_illegal_intersecting_anchors");
  }

  for (const node of payload.nodes) {
    if (!session.ledger.getNode(node.nodeId)) {
      reasons.push(`unknown_node:${node.nodeId}`);
    }
    for (const parentId of node.parentIds ?? []) {
      if (!session.ledger.getNode(parentId)) reasons.push(`unknown_parent:${parentId}`);
    }
    if (node.evidence.length === 0) reasons.push(`missing_evidence:${node.nodeId}`);
    for (const ev of node.evidence) {
      if (ev.type === "path" && !ev.path) reasons.push(`evidence_path_missing:${node.nodeId}`);
      if (ev.type === "commit") {
        if (!ev.sha) reasons.push(`evidence_sha_missing:${node.nodeId}`);
        else if (!gitCommitInRange(session.repoRoot, ev.sha, epoch.base, epoch.target)) {
          reasons.push(`commit_outside_range:${ev.sha}`);
        }
      }
    }
  }
  if (reasons.length) return { id: step.id, status: "rejected", reasons };

  const artifactRef = writeArtifact(session.repoRoot, epoch.epoch_id, "blast.json", payload);
  session.ledger.transaction(() => {
    for (const node of payload.nodes) {
      session.ledger.insertBlastNode(epoch.epoch_id, node.nodeId, node.severity);
      for (const level of requiredLevels(node.severity as BlastSeverity)) {
        session.ledger.insertStep({
          id: `metric:${epoch.epoch_id}:${node.nodeId}:${level}`,
          kind: "metric_decay",
          epochId: epoch.epoch_id,
          nodeId: node.nodeId,
          level,
          blastSeverity: node.severity,
        });
      }
    }
    session.ledger.updateStep(step.id, {
      status: "accepted",
      leaseToken: null,
      leaseExpiresAt: null,
      artifactRef,
    });
  });
  return { id: step.id, status: "accepted" };
}

function acceptMetric(session: Session, step: StepRow, raw: unknown): CompleteResult {
  const parsed = metricPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`invalid_payload: ${parsed.error.message}`],
    };
  }
  const payload: MetricPayload = parsed.data;
  const epochId = step.epoch_id;
  if (!epochId) return { id: step.id, status: "rejected", reasons: ["no_epoch"] };
  const update = payload.updates.find((u) => u.nodeId === step.node_id && u.level === step.level);
  if (!update) {
    return { id: step.id, status: "rejected", reasons: ["update_does_not_match_step"] };
  }
  if (payload.updates.length !== 1) {
    return { id: step.id, status: "rejected", reasons: ["metric_step_expects_one_update"] };
  }
  const blast = session.ledger.getBlastNode(epochId, update.nodeId);
  if (!blast) {
    return { id: step.id, status: "rejected", reasons: ["node_not_in_blast"] };
  }
  const severity = blast.severity as BlastSeverity;
  const levels = requiredLevels(severity);
  if (!levels.includes(update.level)) {
    return { id: step.id, status: "rejected", reasons: ["level_not_required"] };
  }
  const stored = session.ledger.getMetric(update.nodeId, update.level);
  const previous = stored === null ? 1.0 : stored;
  const cap = severityCap(severity, update.level);
  const maxAllowed = cap === null ? previous : Math.min(previous, cap);
  if (update.value > maxAllowed) {
    return {
      id: step.id,
      status: "rejected",
      reasons: [`value_exceeds_cap:${update.value}>${maxAllowed}`],
    };
  }
  const artifactRef = writeArtifact(
    session.repoRoot,
    epochId,
    `metric-${update.nodeId}-${update.level}.json`,
    payload,
  );
  session.ledger.transaction(() => {
    session.ledger.setMetric(update.nodeId, update.level, update.value);
    session.ledger.noteMetricDrop(update.nodeId, stored, update.value, { treatNullAsFull: true });
    decayParents(session, update.nodeId, update.level, update.value);
    session.ledger.updateStep(step.id, {
      status: "accepted",
      leaseToken: null,
      leaseExpiresAt: null,
      artifactRef,
    });
  });
  return { id: step.id, status: "accepted" };
}

function decayParents(
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

export function runWorkFail(
  session: Session,
  raw: unknown,
): { exitCode: number; body: Record<string, unknown> } {
  const parsed = failuresEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CliError(`Invalid fail envelope: ${parsed.error.message}`, EXIT_USAGE, {
      issues: parsed.error.issues,
    });
  }
  const results: CompleteResult[] = [];
  for (const item of parsed.data.failures) {
    const step = session.ledger.getStep(item.id);
    if (!step) {
      results.push({ id: item.id, status: "rejected", reasons: ["unknown_step"] });
      continue;
    }
    if (isMapHopKind(step.kind)) {
      results.push({
        id: item.id,
        status: "rejected",
        reasons: ["map_hop_has_no_work_fail"],
      });
      continue;
    }
    if (step.status !== "leased" || step.lease_token !== item.leaseToken) {
      results.push({ id: item.id, status: "rejected", reasons: ["bad_lease"] });
      continue;
    }
    session.ledger.updateStep(step.id, {
      status: "failed",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    results.push({ id: item.id, status: "accepted" });
  }
  const anyRejected = results.some((r) => r.status === "rejected");
  return {
    exitCode: anyRejected ? EXIT_ATTENTION : EXIT_OK,
    body: envelope("work.fail", session.repoRoot, session.gitHead, {
      ok: !anyRejected,
      results,
    }),
  };
}

export async function readStdinOrFlag(jsonFlag?: string): Promise<unknown> {
  if (jsonFlag) {
    try {
      return JSON.parse(jsonFlag);
    } catch {
      throw new CliError("Invalid JSON in --input / --completions", EXIT_USAGE);
    }
  }
  const stdin = await Bun.stdin.text();
  if (!stdin.trim()) {
    throw new CliError("Expected JSON on stdin or --input", EXIT_USAGE);
  }
  try {
    return JSON.parse(stdin);
  } catch {
    throw new CliError("Invalid JSON on stdin", EXIT_USAGE);
  }
}
