import { z } from "zod";
import { AGENT_ENTITY_TYPES } from "../domain/types.ts";

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const detailAnchorSchema = z
  .object({
    path: z.string().min(1),
    symbol: z.string().optional(),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
    /** Lines from startLine down to identity (name/declaration) line; 0 = startLine is identity. */
    locatorOffset: z.number().int().min(0),
  })
  .strict();

export const detailNodeSchema = z
  .object({
    slug: slugSchema,
    title: z.string().optional(),
    type: z.enum(AGENT_ENTITY_TYPES),
    op: z.literal("upsert"),
    leaf: z.boolean().optional(),
    proseRef: z.string().optional(),
    body: z.string().optional(),
    bodyMd: z.string().optional(),
    anchors: z.array(detailAnchorSchema).optional(),
  })
  .strict();

/** Non-hierarchy relevance link between entities (not parent→child). */
export const detailRefSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    kind: z.string().min(1).optional(),
  })
  .strict();

export const detailClearEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    kind: z.string().min(1).optional(),
  })
  .strict();

/** Inner completions[].payload when kind=detail. Metrics stripped before parse. */
export const detailPayloadSchema = z
  .object({
    parentSlug: z.string().min(1),
    nodes: z.array(detailNodeSchema),
    children: z.array(z.string().min(1)).default([]),
    refs: z.array(detailRefSchema).default([]),
    retire: z.array(z.string().min(1)).default([]),
    clearEdges: z.array(detailClearEdgeSchema).default([]),
    unchanged: z.boolean(),
  })
  .strict();

export type DetailPayload = z.infer<typeof detailPayloadSchema>;

const structureUpsertNode = z.object({
  op: z.literal("upsert_node"),
  node: z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    kind: z.string().optional(),
    type: z.string().optional(),
    parentIds: z.array(z.string()).optional(),
    codeAnchors: z
      .array(
        z.object({
          path: z.string(),
          symbol: z.string().nullable().optional(),
          startLine: z.number().int().optional(),
          endLine: z.number().int().optional(),
        }),
      )
      .optional(),
    leaf: z.boolean().optional(),
  }),
});

const structureRetireNode = z.object({
  op: z.literal("retire_node"),
  nodeId: z.string().min(1),
  reason: z.string().optional(),
});

const structureSetEdge = z.object({
  op: z.literal("set_edge"),
  from: z.string().min(1),
  to: z.string().min(1),
  edgeKind: z.string().optional(),
});

const structureClearEdge = z.object({
  op: z.literal("clear_edge"),
  from: z.string().min(1),
  to: z.string().min(1),
  edgeKind: z.string().optional(),
});

export const structurePayloadSchema = z.object({
  schemaVersion: z.number(),
  base: z.string().min(1),
  target: z.string().min(1),
  ops: z.array(
    z.discriminatedUnion("op", [
      structureUpsertNode,
      structureRetireNode,
      structureSetEdge,
      structureClearEdge,
    ]),
  ),
  coverage: z
    .object({
      touchedPathsConsidered: z.boolean().optional(),
      unmappedPaths: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export type StructurePayload = z.infer<typeof structurePayloadSchema>;

export const blastPayloadSchema = z.object({
  schemaVersion: z.number(),
  base: z.string().min(1),
  target: z.string().min(1),
  nodes: z.array(
    z.object({
      nodeId: z.string().min(1),
      severity: z.enum(["nit", "behavior", "contract", "boundary"]),
      parentIds: z.array(z.string()).optional(),
      evidence: z
        .array(
          z.object({
            type: z.enum(["path", "commit"]),
            path: z.string().optional(),
            sha: z.string().optional(),
          }),
        )
        .min(1),
    }),
  ),
});

export type BlastPayload = z.infer<typeof blastPayloadSchema>;

export const metricPayloadSchema = z.object({
  schemaVersion: z.number(),
  updates: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        level: z.enum(["overview", "contracts", "internals"]),
        value: z.number().min(0).max(1),
        previousValue: z.number().optional(),
        reason: z.string().min(1),
      }),
    )
    .min(1),
});

export type MetricPayload = z.infer<typeof metricPayloadSchema>;

export const completionsEnvelopeSchema = z.object({
  schemaVersion: z.number().optional(),
  completions: z
    .array(
      z.object({
        id: z.string().min(1),
        leaseToken: z.string().min(1),
        kind: z
          .enum([
            "expand",
            "enrich",
            "fix",
            "detail",
            "structure_sync",
            "blast_radius",
            "metric_decay",
          ])
          .optional(),
        payload: z.unknown(),
      }),
    )
    .min(1),
});

export const failuresEnvelopeSchema = z.object({
  schemaVersion: z.number().optional(),
  failures: z
    .array(
      z.object({
        id: z.string().min(1),
        leaseToken: z.string().min(1),
        reason: z.string().optional(),
      }),
    )
    .min(1),
});

/** Strip agent metric fields before detail Zod (ignore, do not reject). */
export function stripDetailMetrics(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  const nodes = p.nodes;
  if (!Array.isArray(nodes)) {
    const { metrics: _m, ...rest } = p;
    return rest;
  }
  return {
    ...p,
    nodes: nodes.map((n) => {
      if (!n || typeof n !== "object") return n;
      const { metrics: _ignored, ...rest } = n as Record<string, unknown>;
      return rest;
    }),
  };
}
