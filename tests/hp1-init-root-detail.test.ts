import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { completeEnvelope, makeGitRepo, readGitignore, snowshoe } from "./helpers.ts";

describe("HP1 cold init → root detail seed", () => {
  test("init auto-enqueues root detail; complete one-hop; map shows rough graph", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.exitCode).toBe(0);
    expect(init.json.rootSlug).toBe("root");
    expect(init.json.seededDetail).toBe(true);
    expect(existsSync(join(repo, ".snowshoe", "ledger.sqlite"))).toBe(true);
    expect(readGitignore(repo)).toContain(".snowshoe/");

    const next = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "5"]);
    expect(next.exitCode).toBe(0);
    const items = next.json.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("detail");
    expect(items[0]?.parentSlug).toBe("root");
    expect(items[0]?.allowedChildTypes).toEqual(["module", "external"]);

    const systemReject = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [{ slug: "not-root", title: "Nope", type: "system", op: "upsert" }],
            edges: [{ from: "root", to: "not-root", kind: "parent" }],
          },
        },
      ]),
    });
    expect(systemReject.exitCode).toBe(1);
    const rejectResults = systemReject.json.results as Array<Record<string, unknown>>;
    expect(rejectResults[0]?.status).toBe("rejected");

    // Reject does not drop a still-valid lease; retry with the same token.
    const complete = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items[0]?.stepId),
          leaseToken: String(items[0]?.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                leaf: false,
                proseRef: ".snowshoe/map/nodes/auth.md",
                anchors: [{ path: "src/missing.ts", symbol: "ghost" }],
                metrics: { overview: 0.9 },
              },
              {
                slug: "github",
                title: "GitHub",
                type: "external",
                op: "upsert",
              },
            ],
            edges: [
              { from: "root", to: "auth", kind: "parent" },
              { from: "root", to: "github", kind: "parent" },
            ],
          },
        },
      ]),
    });
    expect(complete.exitCode).toBe(0);
    const accepted = complete.json.results as Array<Record<string, unknown>>;
    expect(accepted[0]?.status).toBe("accepted");
    expect(accepted[0]?.anchorsUnresolved).toContain("auth:src/missing.ts");

    const map = await snowshoe(repo, ["map", "status", "--json"]);
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
    expect(auth.anchorsUnresolved).toEqual(["src/missing.ts"]);

    const ledger = readFileSync(join(repo, ".snowshoe", "ledger.sqlite"));
    expect(ledger.byteLength).toBeGreaterThan(0);
  });
});
