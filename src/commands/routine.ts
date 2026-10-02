import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StepRow } from "../db/ledger.ts";
import { ROUTINE_KINDS } from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitDiffNames, gitHead, resolveGitRef } from "../git.ts";
import { envelope } from "../json.ts";
import { epochArtifactRel, epochDir } from "../paths.ts";
import type { Session } from "./session.ts";

export function newEpochId(): string {
  return `ep-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

export function writeArtifact(
  repoRoot: string,
  epochId: string,
  name: string,
  data: unknown,
): string {
  const dir = epochDir(repoRoot, epochId);
  mkdirSync(dir, { recursive: true });
  const rel = epochArtifactRel(epochId, name);
  writeFileSync(join(repoRoot, rel), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return rel;
}

function enqueueRoutineSteps(
  session: Session,
  epochId: string,
  prior?: { structure?: string | null; blast?: string | null },
): void {
  session.ledger.insertStep({
    id: `structure:${epochId}`,
    kind: "structure_sync",
    epochId,
    priorArtifactRef: prior?.structure ?? null,
  });
  session.ledger.insertStep({
    id: `blast:${epochId}`,
    kind: "blast_radius",
    epochId,
    priorArtifactRef: prior?.blast ?? null,
  });
}

export function runRoutineRefresh(
  session: Session,
  opts: { target?: string } = {},
): { exitCode: number; body: Record<string, unknown> } {
  const head = session.gitHead ?? gitHead(session.repoRoot);
  if (!head) {
    throw new CliError("Cannot refresh: repository has no HEAD.", EXIT_USAGE);
  }
  const target = opts.target ? resolveGitRef(session.repoRoot, opts.target) : head;
  const open = session.ledger.getOpenEpoch();
  const base = session.ledger.caughtUpBase() ?? head;

  if (open) {
    if (open.target === target) {
      return {
        exitCode: EXIT_OK,
        body: envelope("routine.refresh", session.repoRoot, head, {
          action: "unchanged",
          epochId: open.epoch_id,
          base: open.base,
          target: open.target,
        }),
      };
    }
    const priorStructure = session.ledger.getStep(`structure:${open.epoch_id}`);
    const priorBlast = session.ledger.getStep(`blast:${open.epoch_id}`);
    const epochId = newEpochId();
    session.ledger.transaction(() => {
      session.ledger.supersedeEpoch(open.epoch_id, epochId);
      session.ledger.insertEpoch({ epochId, base: open.base, target });
      enqueueRoutineSteps(session, epochId, {
        structure: priorStructure?.artifact_ref,
        blast: priorBlast?.artifact_ref,
      });
    });
    return {
      exitCode: EXIT_OK,
      body: envelope("routine.refresh", session.repoRoot, head, {
        action: "superseded",
        epochId,
        superseded: open.epoch_id,
        base: open.base,
        target,
      }),
    };
  }

  if (base === target) {
    return {
      exitCode: EXIT_OK,
      body: envelope("routine.refresh", session.repoRoot, head, {
        action: "idle",
        base,
        target,
        behindHead: false,
      }),
    };
  }

  const epochId = newEpochId();
  session.ledger.transaction(() => {
    session.ledger.insertEpoch({ epochId, base, target });
    enqueueRoutineSteps(session, epochId);
  });
  return {
    exitCode: EXIT_OK,
    body: envelope("routine.refresh", session.repoRoot, head, {
      action: "opened",
      epochId,
      base,
      target,
      touchedPaths: gitDiffNames(session.repoRoot, base, target),
    }),
  };
}

export function routineStepSummary(steps: StepRow[]) {
  return steps
    .filter((s) => (ROUTINE_KINDS as readonly string[]).includes(s.kind))
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      status: s.status,
      nodeId: s.node_id,
      level: s.level,
    }));
}

export function canAdvance(session: Session): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const open = session.ledger.getOpenEpoch();
  if (!open) {
    reasons.push("no_open_epoch");
    return { ok: false, reasons };
  }
  const head = session.gitHead ?? gitHead(session.repoRoot);
  if (!head) {
    reasons.push("no_git_head");
    return { ok: false, reasons };
  }
  if (head !== open.target) {
    reasons.push("refresh_required");
  }
  const required = session.ledger.listSteps({
    epochId: open.epoch_id,
    kinds: [...ROUTINE_KINDS],
  });
  const unfinished = required.filter((s) => s.status !== "accepted");
  if (unfinished.length > 0) {
    reasons.push("required_steps_unaccepted");
  }
  return { ok: reasons.length === 0, reasons };
}

export function runRoutineStatus(session: Session): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const head = session.gitHead ?? gitHead(session.repoRoot);
  const open = session.ledger.getOpenEpoch();
  const base = open?.base ?? session.ledger.caughtUpBase();
  const target = open?.target ?? head;
  const steps = open ? session.ledger.listSteps({ epochId: open.epoch_id }) : [];
  const advance = canAdvance(session);
  const detailPending = session.ledger.listSteps({
    kinds: ["expand", "enrich", "fix", "detail"],
    statuses: ["pending", "leased"],
  }).length;
  const behindHead = Boolean(head && base && head !== base);
  const blocked = Boolean(open) && !advance.ok;
  const exitCode = behindHead || blocked ? EXIT_ATTENTION : EXIT_OK;
  return {
    exitCode,
    body: envelope("routine.status", session.repoRoot, head, {
      ok: exitCode === EXIT_OK,
      base,
      target,
      epochId: open?.epoch_id ?? null,
      epochStatus: open?.status ?? null,
      behindHead,
      canAdvance: advance.ok,
      advanceReasons: advance.reasons,
      steps: routineStepSummary(steps),
      detailPending,
      refreshRequired: Boolean(open && head && head !== open.target),
    }),
  };
}

export function runRoutineAdvance(session: Session): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const head = session.gitHead ?? gitHead(session.repoRoot);
  const open = session.ledger.getOpenEpoch();
  const gate = canAdvance(session);
  if (!open || !gate.ok) {
    return {
      exitCode: EXIT_ATTENTION,
      body: envelope("routine.advance", session.repoRoot, head, {
        ok: false,
        canAdvance: false,
        reasons: gate.reasons,
        epochId: open?.epoch_id ?? null,
        detailDoesNotBlock: true,
      }),
    };
  }
  session.ledger.advanceEpoch(open.epoch_id, open.target);
  return {
    exitCode: EXIT_OK,
    body: envelope("routine.advance", session.repoRoot, head, {
      ok: true,
      epochId: open.epoch_id,
      base: open.target,
      target: open.target,
    }),
  };
}
