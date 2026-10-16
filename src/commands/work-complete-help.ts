import { EXIT_OK } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot } from "../paths.ts";

/** Matches `applyStructureOps`: present `codeAnchors` calls `replaceAnchors`; omit skips. */
export const STRUCTURE_SYNC_UPSERT_RULES = [
  "codeAnchors present: replaces ALL anchors for that slug (including []). There is no merge; to add a path, send the full list.",
  "codeAnchors omitted: existing anchors for that slug stay unchanged.",
  "leaf omitted: stored as false (Boolean(undefined)); does not keep the previous leaf flag.",
] as const;

/**
 * Non-empty ops: first node replaces anchors; second omits `codeAnchors` (keep) and `leaf`
 * (→ false). Placeholders match epoch fields on the claimed `structure_sync` item.
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
  "leaf omitted on both → stored as false.",
] as const;

export function workCompleteHelpBody(): Record<string, unknown> {
  return {
    audience: "agent",
    usage: "snowshoe work complete --json",
    input: "JSON envelope on stdin or --input. kind must match the claimed step.",
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
  };
}

export function formatWorkCompleteHelpText(): string {
  const rules = STRUCTURE_SYNC_UPSERT_RULES.map((line) => `- ${line}`).join("\n");
  const notes = STRUCTURE_SYNC_EXAMPLE_NOTES.map((line) => `- ${line}`).join("\n");
  const example = JSON.stringify(STRUCTURE_SYNC_PAYLOAD_EXAMPLE, null, 2);
  return `Payload contract (structure_sync)

Envelope on stdin or --input. kind must match the claimed step.
Map hops (detail / expand / enrich / fix): drain.md.

structure_sync — cover git diff --name-only <base>..<target>. Echo base/target from the item.
Empty ops is OK when every path is already anchored or listed in coverage.unmappedPaths
(not on a cold-start map: empty_ops_cold_start).

upsert_node:
${rules}

Example (replace vs omit):
${notes}

${example}
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
