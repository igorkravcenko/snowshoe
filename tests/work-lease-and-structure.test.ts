import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { commitFile, completeEnvelope, git, makeGitRepo, snowshoe } from "./helpers.ts";

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
        payload: { parentSlug: "root", unchanged: true, nodes: [], edges: [] },
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
    expect(a.kind).toBe("detail");
    const stepId = String(a.stepId);
    const tokenA = String(a.leaseToken);

    const second = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "8"]);
    const secondIds = (second.json.items as Array<Record<string, unknown>>).map((i) => i.stepId);
    expect(secondIds).not.toContain(stepId);
    expect(second.json.items).toEqual([]);

    expireLease(repo, stepId);
    const reclaimed = await snowshoe(repo, ["work", "next", "--json"]);
    const b = (reclaimed.json.items as Array<Record<string, unknown>>)[0]!;
    expect(b.stepId).toBe(stepId);
    expect(String(b.leaseToken)).not.toBe(tokenA);
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
