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
        kind: "detail",
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
  test("learn/quiz do not enqueue work; work kinds share one step; leaf mark still splits", async () => {
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
    expect(node.marks).toHaveLength(3);
    expect(node.marks).toEqual(expect.arrayContaining(["enrich", "detail", "learn"]));

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.json.items).toHaveLength(1);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("detail");
    expect(item.allowedChildTypes).toEqual(["module", "surface", "flow"]);
    expect(item.marks).toHaveLength(2);
    expect(item.marks).toEqual(expect.arrayContaining(["enrich", "detail"]));

    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              { slug: "auth", title: "Auth", type: "module", op: "upsert", leaf: false },
              { slug: "session", title: "Session", type: "module", op: "upsert" },
            ],
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

  test("unmark last work kind cancels pending; symbol may have children", async () => {
    const repo = makeGitRepo();
    await seedModule(repo, "auth", { leaf: false });

    await snowshoe(repo, ["map", "mark", "--slug", "auth", "--kind", "fix", "--json"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [{ slug: "api", title: "API", type: "surface", op: "upsert", leaf: false }],
          }),
        },
      ]),
    });
    expect(done.exitCode).toBe(0);

    await snowshoe(repo, ["map", "mark", "--slug", "api", "--kind", "detail", "--json"]);
    const surfaceNext = await snowshoe(repo, ["work", "next", "--json"]);
    const surfaceItem = (surfaceNext.json.items as Array<Record<string, unknown>>)[0]!;
    const surfaceDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(surfaceItem.stepId),
          leaseToken: String(surfaceItem.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "api",
            nodes: [{ slug: "klass", title: "Class", type: "symbol", op: "upsert", leaf: false }],
          }),
        },
      ]),
    });
    expect(surfaceDone.exitCode).toBe(0);

    await snowshoe(repo, ["map", "mark", "--slug", "klass", "--kind", "detail", "--json"]);
    const hop = await snowshoe(repo, ["work", "next", "--json"]);
    const hopItem = (hop.json.items as Array<Record<string, unknown>>)[0]!;
    expect(hopItem.allowedChildTypes).toEqual(["symbol"]);

    const hopDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hopItem.stepId),
          leaseToken: String(hopItem.leaseToken),
          kind: "detail",
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

    await snowshoe(repo, ["map", "mark", "--slug", "klass-method", "--kind", "detail", "--json"]);
    const unmark = await snowshoe(repo, [
      "map",
      "unmark",
      "--slug",
      "klass-method",
      "--kind",
      "detail",
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
