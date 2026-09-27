import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { envelope } from "../json.ts";
import type { Session } from "./session.ts";
import { ROOT_SLUG, isSlug } from "../domain/types.ts";

export function runMapStatus(session: Session): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const nodes = session.ledger.listNodes().map((n) => {
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
      children: session.ledger.childrenOf(n.slug),
    };
  });

  return {
    exitCode: EXIT_OK,
    body: {
      generatedAt: new Date().toISOString(),
      rootSlug: ROOT_SLUG,
      nodes,
    },
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
