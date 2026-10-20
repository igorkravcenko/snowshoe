import { SEVERITY_CAPS, SEVERITY_LEVELS } from "../domain/metrics.ts";
import { EXIT_OK } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot } from "../paths.ts";

const COMPLETIONS_WRAP =
  "Wrap the payload in completions[] with id / leaseToken / kind matching the claimed step.";

/** Matches `applyStructureOps`: present `codeAnchors` calls `replaceAnchors`; omit skips. */
export const STRUCTURE_SYNC_UPSERT_RULES = [
  "codeAnchors present: replaces ALL anchors for that slug (including []). There is no merge; to add a path, send the full list.",
  "codeAnchors omitted: existing anchors for that slug stay unchanged.",
  "leaf omitted on an existing node: keep the stored flag. New node omit: stored as false. Send an explicit boolean to change it.",
] as const;

/**
 * Non-empty ops: first node replaces anchors; second omits `codeAnchors` (keep).
 * Both omit `leaf`; `cli` is a new slug so omit still stores false.
 * Placeholders match epoch fields on the claimed `structure_sync` item.
 */
export const STRUCTURE_SYNC_PAYLOAD_EXAMPLE = {
  schemaVersion: 1,
  base: "<epoch.base>",
  target: "<epoch.target>",
  ops: [
    {
      op: "upsert_node",
      node: {
        id: "pay",
        title: "Pay",
        kind: "module",
        parentIds: ["root"],
        codeAnchors: [
          { path: "src/pay.ts", symbol: null },
          { path: "src/pay-extra.ts", symbol: null },
        ],
      },
    },
    {
      op: "upsert_node",
      node: {
        id: "cli",
        title: "CLI",
        kind: "module",
      },
    },
  ],
  coverage: {
    touchedPathsConsidered: true,
    unmappedPaths: ["docs/note.md"],
  },
} as const;

export const STRUCTURE_SYNC_EXAMPLE_NOTES = [
  "pay: codeAnchors present → replace ALL anchors on that slug with this list.",
  "cli: codeAnchors omitted → existing anchors unchanged.",
  "cli is a new slug: leaf omitted → stored as false. Keep-on-omit applies only to an already-stored node.",
] as const;

export const BLAST_RADIUS_PAYLOAD_EXAMPLE = {
  schemaVersion: 1,
  base: "<epoch.base>",
  target: "<epoch.target>",
  nodes: [
    {
      nodeId: "pay",
      severity: "nit",
      parentIds: ["root"],
      evidence: [{ type: "path", path: "src/pay.ts" }],
    },
  ],
} as const;

export const METRIC_DECAY_PAYLOAD_EXAMPLE = {
  schemaVersion: 1,
  updates: [
    {
      nodeId: "pay",
      level: "internals",
      value: 0.5,
      reason: "severity:nit",
    },
  ],
} as const;

export function workCompleteHelpBody(): Record<string, unknown> {
  return {
    audience: "agent",
    usage: "snowshoe work complete --json",
    input: "JSON envelope on stdin or --input. kind must match the claimed step.",
    wrap: COMPLETIONS_WRAP,
    mapHops: "detail / expand / enrich / fix payloads: drain.md.",
    structure_sync: {
      summary:
        "Cover git diff --name-only <base>..<target>. Echo base/target from the claimed item.",
      emptyOps:
        "Empty ops is OK when every path is already anchored or listed in coverage.unmappedPaths. Cold start (no nodes) with empty ops rejects empty_ops_cold_start.",
      upsert_node: {
        id: "node.slug ?? node.id (required for each upsert).",
        type: "node.type ?? node.kind (required when the slug is new).",
        codeAnchors: STRUCTURE_SYNC_UPSERT_RULES[0],
        omitCodeAnchors: STRUCTURE_SYNC_UPSERT_RULES[1],
        leaf: STRUCTURE_SYNC_UPSERT_RULES[2],
      },
      exampleNotes: [...STRUCTURE_SYNC_EXAMPLE_NOTES],
      example: STRUCTURE_SYNC_PAYLOAD_EXAMPLE,
    },
    blast_radius: {
      summary:
        "Echo base/target from the claimed item. nodes[]: nodeId, severity (nit|behavior|contract|boundary), optional parentIds, evidence min 1 (type path|commit).",
      emptyNodes:
        "Empty nodes is legal only when git diff base..target does not intersect anchors (else empty_blast_illegal_intersecting_anchors).",
      rejectReasons: [
        "no_epoch",
        "epoch_base_target_mismatch",
        "empty_blast_illegal_intersecting_anchors",
        "unknown_node:<nodeId>",
        "unknown_parent:<parentId>",
        "missing_evidence:<nodeId>",
        "evidence_path_missing:<nodeId>",
        "evidence_sha_missing:<nodeId>",
        "commit_outside_range:<sha>",
        "invalid_payload: …",
      ],
      requiredLevels: SEVERITY_LEVELS,
      severityCaps: SEVERITY_CAPS,
      example: BLAST_RADIUS_PAYLOAD_EXAMPLE,
    },
    metric_decay: {
      summary:
        "Exactly one updates[] row matching the claimed (nodeId, level). value in [0,1]; must not exceed min(storedPrevious, severityCap); missing stored previous is 1.0. previousValue is audit-only.",
      rejectReasons: [
        "no_epoch",
        "update_does_not_match_step",
        "metric_step_expects_one_update",
        "node_not_in_blast",
        "level_not_required",
        "value_exceeds_cap:<value>><maxAllowed>",
        "invalid_payload: …",
      ],
      requiredLevels: SEVERITY_LEVELS,
      severityCaps: SEVERITY_CAPS,
      example: METRIC_DECAY_PAYLOAD_EXAMPLE,
    },
  };
}

function formatSeverityTables(): string {
  const levels = Object.entries(SEVERITY_LEVELS)
    .map(([sev, list]) => `  ${sev}: ${list.join(", ")}`)
    .join("\n");
  const caps = Object.entries(SEVERITY_CAPS)
    .map(([sev, byLevel]) => {
      const parts = Object.entries(byLevel)
        .map(([level, cap]) => `${level}=${cap === null ? "null" : cap}`)
        .join(", ");
      return `  ${sev}: ${parts}`;
    })
    .join("\n");
  return `requiredLevels:\n${levels}\nseverityCaps:\n${caps}`;
}

export function formatWorkCompleteHelpText(): string {
  const rules = STRUCTURE_SYNC_UPSERT_RULES.map((line) => `- ${line}`).join("\n");
  const notes = STRUCTURE_SYNC_EXAMPLE_NOTES.map((line) => `- ${line}`).join("\n");
  const structureExample = JSON.stringify(STRUCTURE_SYNC_PAYLOAD_EXAMPLE, null, 2);
  const blastExample = JSON.stringify(BLAST_RADIUS_PAYLOAD_EXAMPLE, null, 2);
  const metricExample = JSON.stringify(METRIC_DECAY_PAYLOAD_EXAMPLE, null, 2);
  const tables = formatSeverityTables();
  return `Payload contracts

Envelope on stdin or --input. kind must match the claimed step.
${COMPLETIONS_WRAP}
Map hops (detail / expand / enrich / fix): drain.md.

structure_sync — cover git diff --name-only <base>..<target>. Echo base/target from the item.
Empty ops is OK when every path is already anchored or listed in coverage.unmappedPaths
(not on a cold-start map: empty_ops_cold_start).

upsert_node:
${rules}

Example (replace vs omit):
${notes}

${structureExample}

blast_radius — echo base/target. Empty nodes is legal only when the diff does not intersect
anchors (else empty_blast_illegal_intersecting_anchors). Non-empty rows need evidence min 1.
Reject: epoch_base_target_mismatch, unknown_node:…, commit_outside_range:…, missing_evidence:….

${tables}

${blastExample}

metric_decay — exactly one updates[] row matching the claimed (nodeId, level).
value in [0,1]; ≤ min(storedPrevious, severityCap); missing stored previous is 1.0.
previousValue is audit-only.
Reject: update_does_not_match_step, metric_step_expects_one_update, value_exceeds_cap:….

${metricExample}
`;
}

export function runWorkCompleteHelp(cwd = process.cwd()): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const repoRoot = findRepoRoot(cwd);
  return {
    exitCode: EXIT_OK,
    body: envelope("work.complete.help", repoRoot, gitHead(repoRoot), workCompleteHelpBody()),
  };
}
