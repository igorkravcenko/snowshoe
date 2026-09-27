import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { childAllowed, allowedChildTypes } from "../domain/matrix.ts";
import { requiredLevels, severityCap } from "../domain/metrics.ts";
import {
  LEASE_TTL_MS,
  ROOT_SLUG,
  ROUTINE_KINDS,
  type BlastSeverity,
  type EntityType,
  type MetricLevel,
  type StepKind,
  isEntityType,
  isSlug,
} from "../domain/types.ts";
import { gitCommitInRange, gitDiffNames } from "../git.ts";
import { envelope } from "../json.ts";
import { anchorExists, assertAllowedProseRef } from "../paths.ts";
import {
  blastPayloadSchema,
  completionsEnvelopeSchema,
  detailPayloadSchema,
  failuresEnvelopeSchema,
  metricPayloadSchema,
  stripDetailMetrics,
  structurePayloadSchema,
  type MetricPayload,
  type StructurePayload,
} from "../schemas/zod.ts";
import type { Session } from "./session.ts";
import type { StepRow } from "../db/ledger.ts";
import { writeArtifact } from "./routine.ts";

const KIND_PRIORITY: Record<StepKind, number> = {
  structure_sync: 0,
  blast_radius: 1,
  metric_decay: 2,
  detail: 3,
};

function claimable(step: StepRow, now: number): boolean {
  if (step.status === "pending" || step.status === "failed") return true;
  if (step.status === "leased") {
    if (!step.lease_expires_at || step.lease_expires_at <= now) return true;
    return true;
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
  if (step.kind === "detail") {
    return !requiredRoutinePending(session);
  }
  return true;
}

export function runWorkNext(
  session: Session,
  opts: { batchSize?: number } = {},
): { exitCode: number; body: Record<string, unknown> } {
  const batchSize = Math.max(1, opts.batchSize ?? 1);
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
  return {
    exitCode: EXIT_OK,
    body: envelope("work.next", session.repoRoot, session.gitHead, {
      items,
      stop: remaining === 0,
      remaining,
      batchSize,
    }),
  };
}

function formatWorkItem(session: Session, step: StepRow, epochId: string | null) {
  const epoch = epochId ? session.ledger.getEpoch(epochId) : session.ledger.getOpenEpoch();
  const base = {
    stepId: step.id,
    kind: step.kind,
    leaseToken: step.lease_token,
    prior: step.prior_artifact_ref ? { artifactRef: step.prior_artifact_ref } : null,
  };
  if (step.kind === "detail") {
    const parent = step.parent_slug ? session.ledger.getNode(step.parent_slug) : null;
    const types = parent ? allowedChildTypes(parent.type, parent.leaf === 1) : [];
    return {
      ...base,
      parentSlug: step.parent_slug,
      allowedChildTypes: types,
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
  anchorsUnresolved?: string[];
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
  if (item.kind && item.kind !== step.kind) {
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

function acceptDetail(session: Session, step: StepRow, rawPayload: unknown): CompleteResult {
  const stripped = stripDetailMetrics(rawPayload);
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

  if (payload.unchanged) {
    session.ledger.updateStep(step.id, {
      status: "done",
      leaseToken: null,
      leaseExpiresAt: null,
    });
    return { id: step.id, status: "accepted" };
  }

  const reasons: string[] = [];
  const newSlugs = new Set<string>();
  for (const node of payload.nodes) {
    if (node.slug === ROOT_SLUG || node.slug === payload.parentSlug) {
      reasons.push(`cannot_upsert_parent_or_root:${node.slug}`);
    }
    newSlugs.add(node.slug);
  }

  const known = new Set(session.ledger.listNodes().map((n) => n.slug));
  for (const slug of newSlugs) known.add(slug);

  for (const edge of payload.edges) {
    if (edge.from !== payload.parentSlug) {
      reasons.push(`not_one_hop:${edge.from}->${edge.to}`);
    }
    if (!known.has(edge.from) || !known.has(edge.to)) {
      reasons.push(`unknown_edge_endpoint:${edge.from}->${edge.to}`);
    }
  }
  for (const node of payload.nodes) {
    const hasParentEdge = payload.edges.some(
      (e) => e.to === node.slug && e.from === payload.parentSlug,
    );
    if (!hasParentEdge) {
      reasons.push(`missing_parent_edge:${node.slug}`);
    }
    if (!childAllowed(parent.type, node.type)) {
      reasons.push(`matrix_forbid:${parent.type}->${node.type}:${node.slug}`);
    }
    if (node.proseRef) {
      try {
        assertAllowedProseRef(session.repoRoot, node.proseRef);
      } catch (e) {
        reasons.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (reasons.length) {
    return { id: step.id, status: "rejected", reasons };
  }

  const unresolvedAll: string[] = [];
  session.ledger.transaction(() => {
    for (const node of payload.nodes) {
      const existed = session.ledger.getNode(node.slug);
      const leaf = node.type === "symbol" ? true : Boolean(node.leaf);
      session.ledger.upsertNode({
        slug: node.slug,
        title: node.title ?? node.slug,
        type: node.type,
        leaf,
        proseRef: node.proseRef ?? null,
      });
      if (!existed) session.ledger.seedZeroMetrics(node.slug);
      const anchors = (node.anchors ?? []).map((a) => {
        const unresolved = !anchorExists(session.repoRoot, a.path);
        if (unresolved) unresolvedAll.push(`${node.slug}:${a.path}`);
        return {
          path: a.path,
          symbol: a.symbol,
          startLine: a.startLine,
          endLine: a.endLine,
          unresolved,
        };
      });
      if (node.anchors) session.ledger.replaceAnchors(node.slug, anchors);
    }
    for (const edge of payload.edges) {
      session.ledger.setEdge(edge.from, edge.to, edge.kind);
    }
    session.ledger.updateStep(step.id, {
      status: "done",
      leaseToken: null,
      leaseExpiresAt: null,
    });
  });

  return {
    id: step.id,
    status: "accepted",
    ...(unresolvedAll.length ? { anchorsUnresolved: unresolvedAll } : {}),
  };
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
    return { id: step.id, status: "rejected", reasons: [`invalid_payload: ${parsed.error.message}`] };
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
  if (reasons.length) return { id: step.id, status: "rejected", reasons };

  session.ledger.transaction(() => {
    for (const op of payload.ops) {
      if (op.op === "upsert_node") {
        const slug = resolveStructureSlug(op)!;
        const existing = session.ledger.getNode(slug);
        const type = resolveStructureType(op) ?? existing?.type ?? "module";
        const leaf = type === "symbol" ? true : Boolean(op.node.leaf);
        session.ledger.upsertNode({
          slug,
          title: op.node.title ?? existing?.title ?? slug,
          type,
          leaf,
        });
        const anchors = (op.node.codeAnchors ?? []).map((a) => ({
          path: a.path,
          symbol: a.symbol,
          startLine: a.startLine,
          endLine: a.endLine,
          unresolved: false,
        }));
        if (op.node.codeAnchors) session.ledger.replaceAnchors(slug, anchors);
        for (const parentId of op.node.parentIds ?? []) {
          if (session.ledger.getNode(parentId) || seenUpserts.has(parentId)) {
            session.ledger.setEdge(parentId, slug, "parent");
          } else {
            reasons.push(`unresolved_parent:${parentId}`);
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
  });
  if (reasons.length) return { id: step.id, status: "rejected", reasons };

  const touched = gitDiffNames(session.repoRoot, epoch.base, epoch.target);
  const unmapped = new Set(payload.coverage?.unmappedPaths ?? []);
  const anchored = session.ledger.allAnchors().map((a) => a.path);
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
  session.ledger.updateStep(step.id, {
    status: "accepted",
    leaseToken: null,
    leaseExpiresAt: null,
    artifactRef,
  });
  session.ledger.setMeta(`structure_noop:${epoch.epoch_id}`, payload.ops.length === 0 ? "1" : "0");
  session.ledger.setMeta(
    `structure_unmapped:${epoch.epoch_id}`,
    JSON.stringify(payload.coverage?.unmappedPaths ?? []),
  );
  return { id: step.id, status: "accepted" };
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
    const re = new RegExp(
      `^${a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
    );
    return re.test(p);
  }
  return p === a || p.startsWith(`${a}/`);
}

function acceptBlast(session: Session, step: StepRow, raw: unknown): CompleteResult {
  const parsed = blastPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { id: step.id, status: "rejected", reasons: [`invalid_payload: ${parsed.error.message}`] };
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
    return { id: step.id, status: "rejected", reasons: [`invalid_payload: ${parsed.error.message}`] };
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
    if (childValue < current) session.ledger.setMetric(parent, level, childValue);
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
    if (step.kind === "detail") {
      results.push({
        id: item.id,
        status: "rejected",
        reasons: ["detail_has_no_work_fail"],
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
