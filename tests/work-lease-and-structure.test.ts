import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  commitFile,
  completeEnvelope,
  detailPayload,
  git,
  makeGitRepo,
  snowshoe,
} from "./helpers.ts";

function openLedger(repo: string): Database {
  return new Database(join(repo, ".snowshoe", "ledger.sqlite"));
}

function graphSnapshot(repo: string): {
  nodeCount: number;
  edges: Array<{ from_slug: string; to_slug: string; kind: string }>;
} {
  const db = openLedger(repo);
  try {
    const nodeCount = (db.query("SELECT COUNT(*) AS n FROM nodes").get() as { n: number }).n;
    const edges = db
      .query("SELECT from_slug, to_slug, kind FROM edges ORDER BY from_slug, to_slug, kind")
      .all() as Array<{ from_slug: string; to_slug: string; kind: string }>;
    return { nodeCount, edges };
  } finally {
    db.close();
  }
}

function expireLease(repo: string, stepId: string): void {
  const db = openLedger(repo);
  try {
    db.run("UPDATE steps SET lease_expires_at = 0 WHERE id = ?", [stepId]);
  } finally {
    db.close();
  }
}

function stepStatus(repo: string, stepId: string): string | null {
  const db = openLedger(repo);
  try {
    const row = db.query("SELECT status FROM steps WHERE id = ?").get(stepId) as {
      status: string;
    } | null;
    return row?.status ?? null;
  } finally {
    db.close();
  }
}

async function completeRootUnchanged(repo: string): Promise<void> {
  const next = await snowshoe(repo, ["work", "next", "--json"]);
  const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
  const done = await snowshoe(repo, ["work", "complete", "--json"], {
    stdin: completeEnvelope([
      {
        id: String(item.stepId),
        leaseToken: String(item.leaseToken),
        kind: "detail",
        payload: detailPayload({ parentSlug: "root", unchanged: true }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("work next lease TTL", () => {
  test("overlapping work next does not re-lease a still-valid lease", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);

    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const a = (first.json.items as Array<Record<string, unknown>>)[0]!;
    expect(a.kind).toBe("expand");
    const stepId = String(a.stepId);
    const tokenA = String(a.leaseToken);

    const second = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "8"]);
    const secondIds = (second.json.items as Array<Record<string, unknown>>).map((i) => i.stepId);
    expect(secondIds).not.toContain(stepId);
    expect(second.json.items).toEqual([]);
    expect(second.json.action).toBe("work");
    expect(second.json.stop).toBe(false);
    const leased = second.json.leased as Array<Record<string, unknown>>;
    expect(leased).toHaveLength(1);
    expect(leased[0]?.stepId).toBe(stepId);
    expect(String(leased[0]?.leaseToken)).toBe(tokenA);

    expireLease(repo, stepId);
    const reclaimed = await snowshoe(repo, ["work", "next", "--json"]);
    const b = (reclaimed.json.items as Array<Record<string, unknown>>)[0]!;
    expect(b.stepId).toBe(stepId);
    expect(String(b.leaseToken)).not.toBe(tokenA);
    expect(reclaimed.json.leased).toEqual([]);
  });

  test("second work next may mint more items; leftovers stay in leased with same tokens", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const rootNext = await snowshoe(repo, ["work", "next", "--json"]);
    const root = (rootNext.json.items as Array<Record<string, unknown>>)[0]!;
    const seeded = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(root.stepId),
          leaseToken: String(root.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: ["alpha", "beta", "gamma", "delta"].map((slug) => ({
              slug,
              title: slug,
              type: "module",
              op: "upsert",
            })),
          }),
        },
      ]),
    });
    expect(seeded.exitCode).toBe(0);

    for (const slug of ["alpha", "beta", "gamma", "delta"]) {
      const mark = await snowshoe(repo, [
        "map",
        "mark",
        "--json",
        "--slug",
        slug,
        "--kind",
        "expand",
      ]);
      expect(mark.exitCode).toBe(0);
    }

    const first = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "2"]);
    const firstItems = first.json.items as Array<Record<string, unknown>>;
    expect(firstItems).toHaveLength(2);
    expect(first.json.leased).toEqual([]);
    const firstIds = firstItems.map((i) => String(i.stepId));
    const firstTokens = Object.fromEntries(
      firstItems.map((i) => [String(i.stepId), String(i.leaseToken)]),
    );

    const second = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "2"]);
    const secondItems = second.json.items as Array<Record<string, unknown>>;
    const secondLeased = second.json.leased as Array<Record<string, unknown>>;
    expect(secondItems).toHaveLength(2);
    expect(secondLeased).toHaveLength(2);
    const secondItemIds = secondItems.map((i) => String(i.stepId));
    const leasedIds = secondLeased.map((i) => String(i.stepId));
    expect(leasedIds.sort()).toEqual([...firstIds].sort());
    for (const row of secondLeased) {
      expect(String(row.leaseToken)).toBe(firstTokens[String(row.stepId)]);
    }
    expect(secondItemIds.some((id) => firstIds.includes(id))).toBe(false);

    const doneOne = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(firstItems[0]!.stepId),
          leaseToken: String(firstItems[0]!.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: String(firstItems[0]!.parentSlug),
            unchanged: true,
          }),
        },
      ]),
    });
    expect(doneOne.exitCode).toBe(0);

    const third = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "2"]);
    expect(third.json.items).toEqual([]);
    const thirdLeased = third.json.leased as Array<Record<string, unknown>>;
    expect(thirdLeased.map((i) => String(i.stepId)).sort()).toEqual(
      [firstIds[1]!, ...secondItemIds].sort(),
    );
  });

  test("refresh under a live routine lease does not stick the new epoch", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await completeRootUnchanged(repo);
    commitFile(repo, "docs/note.md", "n\n", "docs: note");
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const a = (first.json.items as Array<Record<string, unknown>>)[0]!;
    expect(a.kind).toBe("structure_sync");
    const oldStepId = String(a.stepId);
    const oldToken = String(a.leaseToken);

    commitFile(repo, "docs/other.md", "o\n", "docs: other");
    const gated = await snowshoe(repo, ["work", "next", "--json"]);
    expect(gated.json.action).toBe("refresh");
    expect(gated.json.todo).toBe("snowshoe routine refresh --json");
    expect(gated.json.items).toEqual([]);
    const gatedLeased = gated.json.leased as Array<Record<string, unknown>>;
    expect(gatedLeased.map((i) => i.stepId)).toContain(oldStepId);
    expect(String(gatedLeased.find((i) => i.stepId === oldStepId)?.leaseToken)).toBe(oldToken);

    const refreshed = await snowshoe(repo, ["routine", "refresh", "--json"]);
    expect(refreshed.json.action).toBe("superseded");
    const base = String(refreshed.json.base);
    const target = String(refreshed.json.target);

    const nextE2 = await snowshoe(repo, ["work", "next", "--json"]);
    const e2Items = nextE2.json.items as Array<Record<string, unknown>>;
    const e2Leased = nextE2.json.leased as Array<Record<string, unknown>>;
    expect(e2Items.map((i) => i.stepId)).not.toContain(oldStepId);
    expect(e2Leased.map((i) => i.stepId)).not.toContain(oldStepId);
    const structure = e2Items[0]!;
    expect(structure.kind).toBe("structure_sync");

    const sDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(structure.stepId),
          leaseToken: String(structure.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [],
            coverage: {
              touchedPathsConsidered: true,
              unmappedPaths: ["docs/note.md", "docs/other.md"],
            },
          },
        },
      ]),
    });
    expect(sDone.exitCode).toBe(0);

    const blastNext = await snowshoe(repo, ["work", "next", "--json"]);
    const blast = (blastNext.json.items as Array<Record<string, unknown>>)[0]!;
    expect(blast.kind).toBe("blast_radius");
    const bDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(blast.stepId),
          leaseToken: String(blast.leaseToken),
          kind: "blast_radius",
          payload: { schemaVersion: 1, base, target, nodes: [] },
        },
      ]),
    });
    expect(bDone.exitCode).toBe(0);

    const ready = await snowshoe(repo, ["work", "next", "--json"]);
    expect(ready.json.action).toBe("advance");
    expect(ready.json.items).toEqual([]);
    expect(ready.json.leased).toEqual([]);

    expireLease(repo, oldStepId);
    const afterExpire = await snowshoe(repo, ["work", "next", "--json"]);
    expect(afterExpire.json.action).toBe("advance");
    const expiredItems = afterExpire.json.items as Array<Record<string, unknown>>;
    expect(expiredItems.map((i) => i.stepId)).not.toContain(oldStepId);
  });

  test("work fail resets a routine lease so the next poll can reclaim", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await completeRootUnchanged(repo);
    commitFile(repo, "docs/note.md", "n\n", "docs: note");
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const a = (first.json.items as Array<Record<string, unknown>>)[0]!;
    expect(a.kind).toBe("structure_sync");
    const stepId = String(a.stepId);
    const tokenA = String(a.leaseToken);

    const overlap = await snowshoe(repo, ["work", "next", "--json"]);
    expect(
      (overlap.json.items as Array<Record<string, unknown>>).map((i) => i.stepId),
    ).not.toContain(stepId);

    const fail = await snowshoe(repo, ["work", "fail", "--json"], {
      stdin: JSON.stringify({
        schemaVersion: 1,
        failures: [{ id: stepId, leaseToken: tokenA, reason: "retry" }],
      }),
    });
    expect(fail.exitCode).toBe(0);

    const again = await snowshoe(repo, ["work", "next", "--json"]);
    const b = (again.json.items as Array<Record<string, unknown>>)[0]!;
    expect(b.stepId).toBe(stepId);
    expect(String(b.leaseToken)).not.toBe(tokenA);
  });
});

describe("structure complete does not dirty the graph on reject", () => {
  test("uncovered path rejects and leaves nodeCount/edges unchanged", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await completeRootUnchanged(repo);
    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "src/pay.ts", "export const x = 1;\n", "feat: pay");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const before = graphSnapshot(repo);
    expect(before.nodeCount).toBeGreaterThan(0);

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("structure_sync");

    const rejected = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [
              {
                op: "upsert_node",
                node: {
                  id: "pay",
                  title: "Pay",
                  kind: "module",
                  parentIds: ["root"],
                  codeAnchors: [{ path: "src/other.ts", symbol: null }],
                },
              },
            ],
            coverage: { touchedPathsConsidered: true, unmappedPaths: [] },
          },
        },
      ]),
    });
    expect(rejected.exitCode).toBe(1);
    const results = rejected.json.results as Array<Record<string, unknown>>;
    expect(results[0]?.status).toBe("rejected");
    expect(results[0]?.reasons).toEqual(
      expect.arrayContaining([expect.stringMatching(/^coverage_unmapped:/)]),
    );

    const after = graphSnapshot(repo);
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.edges).toEqual(before.edges);
    expect(stepStatus(repo, String(item.stepId))).toBe("leased");
  });

  test("unresolved parent rejects without applying ops", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await completeRootUnchanged(repo);
    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "src/pay.ts", "export const x = 1;\n", "feat: pay");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const before = graphSnapshot(repo);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;

    const rejected = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [
              {
                op: "upsert_node",
                node: {
                  id: "pay",
                  title: "Pay",
                  kind: "module",
                  parentIds: ["missing-parent"],
                  codeAnchors: [{ path: "src/pay.ts", symbol: null }],
                },
              },
            ],
            coverage: { touchedPathsConsidered: true, unmappedPaths: [] },
          },
        },
      ]),
    });
    expect(rejected.exitCode).toBe(1);
    const results = rejected.json.results as Array<Record<string, unknown>>;
    expect(results[0]?.reasons).toContain("unresolved_parent:missing-parent");
    const after = graphSnapshot(repo);
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.edges).toEqual(before.edges);
  });
});

async function nodeLeaf(repo: string, slug: string): Promise<boolean | undefined> {
  const status = await snowshoe(repo, ["map", "status", "--json", "--all-fields", "--slug", slug]);
  const node = (status.json.nodes as Array<Record<string, unknown>>).find((n) => n.slug === slug);
  return node?.leaf as boolean | undefined;
}

describe("upsert omit leaf keeps stored flag", () => {
  test("structure_sync omit leaf keeps existing true; new omit is false; explicit false clears", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const rootNext = await snowshoe(repo, ["work", "next", "--json"]);
    const root = (rootNext.json.items as Array<Record<string, unknown>>)[0]!;
    const seeded = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(root.stepId),
          leaseToken: String(root.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "pay", title: "Pay", type: "module", op: "upsert", leaf: true }],
          }),
        },
      ]),
    });
    expect(seeded.exitCode).toBe(0);
    expect(await nodeLeaf(repo, "pay")).toBe(true);

    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "src/pay.ts", "export const x = 1;\n", "feat: pay");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("structure_sync");
    const kept = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [
              {
                op: "upsert_node",
                node: {
                  id: "pay",
                  title: "Pay",
                  kind: "module",
                  parentIds: ["root"],
                  codeAnchors: [{ path: "src/pay.ts", symbol: null }],
                },
              },
              {
                op: "upsert_node",
                node: {
                  id: "extra",
                  title: "Extra",
                  kind: "module",
                  parentIds: ["root"],
                },
              },
            ],
            coverage: { touchedPathsConsidered: true, unmappedPaths: [] },
          },
        },
      ]),
    });
    expect(kept.exitCode).toBe(0);
    expect(await nodeLeaf(repo, "pay")).toBe(true);
    expect(await nodeLeaf(repo, "extra")).toBe(false);

    commitFile(repo, "src/pay-two.ts", "export const y = 2;\n", "feat: pay two");
    const target2 = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);
    const next2 = await snowshoe(repo, ["work", "next", "--json"]);
    const item2 = (next2.json.items as Array<Record<string, unknown>>)[0]!;
    const cleared = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item2.stepId),
          leaseToken: String(item2.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target: target2,
            ops: [
              {
                op: "upsert_node",
                node: {
                  id: "pay",
                  title: "Pay",
                  kind: "module",
                  parentIds: ["root"],
                  leaf: false,
                  codeAnchors: [
                    { path: "src/pay.ts", symbol: null },
                    { path: "src/pay-two.ts", symbol: null },
                  ],
                },
              },
            ],
            coverage: { touchedPathsConsidered: true, unmappedPaths: [] },
          },
        },
      ]),
    });
    expect(cleared.exitCode).toBe(0);
    expect(await nodeLeaf(repo, "pay")).toBe(false);
  });

  test("map hop omit leaf keeps existing true", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const rootNext = await snowshoe(repo, ["work", "next", "--json"]);
    const root = (rootNext.json.items as Array<Record<string, unknown>>)[0]!;
    const seeded = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(root.stepId),
          leaseToken: String(root.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "auth", title: "Auth", type: "module", op: "upsert", leaf: true }],
          }),
        },
      ]),
    });
    expect(seeded.exitCode).toBe(0);
    expect(await nodeLeaf(repo, "auth")).toBe(true);

    const mark = await snowshoe(repo, [
      "map",
      "mark",
      "--json",
      "--slug",
      "auth",
      "--kind",
      "enrich",
    ]);
    expect(mark.exitCode).toBe(0);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("enrich");
    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "enrich",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [{ slug: "auth", title: "Auth module", type: "module", op: "upsert" }],
            children: [],
          }),
        },
      ]),
    });
    expect(done.exitCode).toBe(0);
    expect(await nodeLeaf(repo, "auth")).toBe(true);
  });
});
