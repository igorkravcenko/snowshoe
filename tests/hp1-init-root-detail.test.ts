import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  completeEnvelope,
  detailPayload,
  makeGitRepo,
  readGitignore,
  snowshoe,
} from "./helpers.ts";

describe("HP1 cold init → root detail seed", () => {
  test("init auto-enqueues root detail; complete one-hop; map shows rough graph", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.exitCode).toBe(0);
    expect(init.json.rootSlug).toBe("root");
    expect(init.json.seededDetail).toBe(true);
    expect(existsSync(join(repo, ".snowshoe", "ledger.sqlite"))).toBe(true);
    const gi = readGitignore(repo);
    expect(gi).toMatch(/(^|\n)\.snowshoe(\n|$)/);
    expect(gi).toMatch(/(^|\n)\.snowshoe\/(\n|$)/);

    const next = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "5"]);
    expect(next.exitCode).toBe(0);
    expect(next.json.action).toBe("work");
    expect(next.json.batchSize).toBe(5);
    const items = next.json.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("expand");
    expect(items[0]?.parentSlug).toBe("root");
    expect(items[0]?.allowedChildTypes).toEqual(["module", "external"]);
    expect(items[0]?.children).toEqual([]);

    const systemReject = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "not-root", title: "Nope", type: "system", op: "upsert" }],
          }),
        },
      ]),
    });
    expect(systemReject.exitCode).toBe(1);
    const rejectResults = systemReject.json.results as Array<Record<string, unknown>>;
    expect(rejectResults[0]?.status).toBe("rejected");

    const edgesReject = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [{ slug: "cli", title: "CLI", type: "module", op: "upsert" }],
            edges: [{ from: "root", to: "cli", kind: "parent" }],
          },
        },
      ]),
    });
    expect(edgesReject.exitCode).toBe(1);
    const edgeResults = edgesReject.json.results as Array<Record<string, unknown>>;
    const edgeReasons = (edgeResults[0]?.reasons ?? []) as string[];
    expect(edgeReasons[0]).toMatch(/^edges_removed:/);

    const missingAnchor = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                anchors: [{ path: "src/missing.ts", symbol: "ghost", locatorOffset: 0 }],
              },
            ],
          }),
        },
      ]),
    });
    expect(missingAnchor.exitCode).toBe(1);
    const missingResults = missingAnchor.json.results as Array<Record<string, unknown>>;
    expect(missingResults[0]?.status).toBe("rejected");
    expect(missingResults[0]?.reasons).toEqual(
      expect.arrayContaining(["anchor_missing:auth:src/missing.ts"]),
    );
    expect(missingResults[0]?.anchorsUnresolved).toBeUndefined();

    // Reject does not drop a still-valid lease; retry with the same token.
    const complete = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                leaf: false,
                proseRef: ".snowshoe/map/nodes/auth.md",
                anchors: [{ path: "README.md", symbol: "fixture", startLine: 1, locatorOffset: 0 }],
                metrics: { overview: 0.9 },
              },
              {
                slug: "github",
                title: "GitHub",
                type: "external",
                op: "upsert",
              },
            ],
            refs: [{ from: "auth", to: "github", kind: "uses" }],
          }),
        },
      ]),
    });
    expect(complete.exitCode).toBe(0);
    const accepted = complete.json.results as Array<Record<string, unknown>>;
    expect(accepted[0]?.status).toBe("accepted");
    expect(accepted[0]?.anchorsUnresolved).toBeUndefined();

    const map = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
    expect(map.exitCode).toBe(0);
    expect(map.json.rootSlug).toBe("root");
    const nodes = map.json.nodes as Array<Record<string, unknown>>;
    const slugs = nodes.map((n) => n.slug);
    expect(slugs).toContain("root");
    expect(slugs).toContain("auth");
    expect(slugs).toContain("github");
    const root = nodes.find((n) => n.slug === "root")!;
    expect(root.type).toBe("system");
    expect(root.children).toEqual(expect.arrayContaining(["auth", "github"]));
    const auth = nodes.find((n) => n.slug === "auth")!;
    expect(auth.type).toBe("module");
    expect((auth.metrics as Record<string, number>).overview).toBe(0);
    expect(auth.anchorsUnresolved).toBeUndefined();
    expect(auth.refs).toEqual([{ to: "github", kind: "uses" }]);

    const ledger = readFileSync(join(repo, ".snowshoe", "ledger.sqlite"));
    expect(ledger.byteLength).toBeGreaterThan(0);
  });
});
