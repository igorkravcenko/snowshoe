import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedModule(
  repo: string,
  slug: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await snowshoe(repo, ["init", "--json"]);
  const next = await snowshoe(repo, ["work", "next", "--json"]);
  const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
  const done = await snowshoe(repo, ["work", "complete", "--json"], {
    stdin: completeEnvelope([
      {
        id: String(item.stepId),
        leaseToken: String(item.leaseToken),
        kind: String(item.kind),
        payload: detailPayload({
          parentSlug: "root",
          nodes: [{ slug, title: "Auth", type: "module", op: "upsert", leaf: true, ...extra }],
        }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("map polish: marks, leaf, anchors", () => {
  test("learn/quiz do not enqueue; expand and enrich are separate hops", async () => {
    const repo = makeGitRepo();
    await seedModule(repo, "auth");

    const learn = await snowshoe(repo, [
      "map",
      "mark",
      "--slug",
      "auth",
      "--kind",
      "learn",
      "--json",
    ]);
    expect(learn.exitCode).toBe(0);
    const idle = await snowshoe(repo, ["work", "next", "--json"]);
    expect(idle.json.action).toBe("idle");
    expect(idle.json.items).toEqual([]);

    const leafMark = await snowshoe(repo, ["map", "detail", "mark", "--slug", "auth", "--json"]);
    expect(leafMark.exitCode).toBe(0);
    const enrich = await snowshoe(repo, [
      "map",
      "mark",
      "--slug",
      "auth",
      "--kind",
      "enrich",
      "--json",
    ]);
    expect(enrich.exitCode).toBe(0);

    const status = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--all-fields",
      "--slug",
      "auth",
    ]);
    const node = (status.json.nodes as Array<Record<string, unknown>>)[0]!;
    expect(node.leaf).toBe(true);
    expect(node.marks).toEqual(expect.arrayContaining(["enrich", "expand", "learn"]));

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const items = next.json.items as Array<Record<string, unknown>>;
    expect(items.map((i) => i.kind).sort()).toEqual(["enrich", "expand"]);
    const expand = items.find((i) => i.kind === "expand")!;
    const enrichItem = items.find((i) => i.kind === "enrich")!;
    expect(expand.allowedChildTypes).toEqual(["module", "surface", "flow"]);
    expect(expand.marks).toEqual(["expand"]);
    expect(enrichItem.allowedChildTypes).toEqual([]);

    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(expand.stepId),
          leaseToken: String(expand.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              { slug: "auth", title: "Auth", type: "module", op: "upsert", leaf: false },
              { slug: "session", title: "Session", type: "module", op: "upsert" },
            ],
          }),
        },
        {
          id: String(enrichItem.stepId),
          leaseToken: String(enrichItem.leaseToken),
          kind: "enrich",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              {
                slug: "auth",
                title: "Auth module",
                type: "module",
                op: "upsert",
                leaf: false,
                body: "Auth owns sessions.",
              },
            ],
            children: [],
          }),
        },
      ]),
    });
    expect(done.exitCode).toBe(0);
    const after = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--all-fields",
      "--slug",
      "auth",
    ]);
    const auth = (after.json.nodes as Array<Record<string, unknown>>)[0]!;
    expect(auth.detailStatus).toBeNull();
    expect(auth.marks).toEqual(["learn"]);
    expect(auth.children).toEqual(["session"]);
  });

  test("enrich rejects growing children", async () => {
    const repo = makeGitRepo();
    await seedModule(repo, "auth", { leaf: false });
    await snowshoe(repo, ["map", "mark", "--slug", "auth", "--kind", "enrich", "--json"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    const bad = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "enrich",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [{ slug: "session", title: "Session", type: "module", op: "upsert" }],
          }),
        },
      ]),
    });
    expect(bad.exitCode).not.toBe(0);
    const results = bad.json.results as Array<{ status: string; reasons?: string[] }>;
    expect(results[0]?.status).toBe("rejected");
    expect(results[0]?.reasons?.some((r) => r.startsWith("enrich_"))).toBe(true);
  });

  test("unmark last work kind cancels pending; symbol may have children", async () => {
    const repo = makeGitRepo();
    await seedModule(repo, "auth", { leaf: false });

    await snowshoe(repo, ["map", "mark", "--slug", "auth", "--kind", "fix", "--json"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("fix");
    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "fix",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [{ slug: "api", title: "API", type: "surface", op: "upsert", leaf: false }],
          }),
        },
      ]),
    });
    expect(done.exitCode).toBe(0);

    await snowshoe(repo, ["map", "mark", "--slug", "api", "--kind", "expand", "--json"]);
    const surfaceNext = await snowshoe(repo, ["work", "next", "--json"]);
    const surfaceItem = (surfaceNext.json.items as Array<Record<string, unknown>>)[0]!;
    const surfaceDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(surfaceItem.stepId),
          leaseToken: String(surfaceItem.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: "api",
            nodes: [{ slug: "klass", title: "Class", type: "symbol", op: "upsert", leaf: false }],
          }),
        },
      ]),
    });
    expect(surfaceDone.exitCode).toBe(0);

    await snowshoe(repo, ["map", "mark", "--slug", "klass", "--kind", "expand", "--json"]);
    const hop = await snowshoe(repo, ["work", "next", "--json"]);
    const hopItem = (hop.json.items as Array<Record<string, unknown>>)[0]!;
    expect(hopItem.allowedChildTypes).toEqual(["symbol"]);

    const hopDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hopItem.stepId),
          leaseToken: String(hopItem.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: "klass",
            nodes: [
              { slug: "klass-method", title: "method", type: "symbol", op: "upsert", leaf: true },
            ],
          }),
        },
      ]),
    });
    expect(hopDone.exitCode).toBe(0);

    await snowshoe(repo, ["map", "mark", "--slug", "klass-method", "--kind", "expand", "--json"]);
    const unmark = await snowshoe(repo, [
      "map",
      "unmark",
      "--slug",
      "klass-method",
      "--kind",
      "expand",
      "--json",
    ]);
    expect(unmark.exitCode).toBe(0);
    const idle = await snowshoe(repo, ["work", "next", "--json"]);
    expect(idle.json.action).toBe("idle");
  });

  test("persists fragment size and start lineText", async () => {
    const repo = makeGitRepo();
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "span.ts"), "one\ntwo\nthree\n");
    await seedModule(repo, "auth", {
      leaf: false,
      anchors: [{ path: "src/span.ts", startLine: 1, endLine: 3 }],
    });
    const status = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--all-fields",
      "--slug",
      "auth",
    ]);
    const node = (status.json.nodes as Array<Record<string, unknown>>)[0]!;
    const anchors = node.anchors as Array<Record<string, unknown>>;
    expect(anchors[0]?.startLine).toBe(1);
    expect(anchors[0]?.endLine).toBe(3);
    expect(anchors[0]?.span).toBe(3);
    expect(anchors[0]?.lineText).toBe("one");
  });
});
