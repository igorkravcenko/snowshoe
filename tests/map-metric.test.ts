import { describe, expect, test } from "bun:test";
import { detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedRootChild(repo: string): Promise<void> {
  await snowshoe(repo, ["init", "--json", "--locale", "en"]);
  const next = await snowshoe(repo, ["work", "next", "--json"]);
  const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
  expect(item.kind).toBe("expand");
  const done = await snowshoe(repo, ["work", "complete", "--json"], {
    stdin: JSON.stringify({
      schemaVersion: 1,
      completions: [
        {
          id: item.stepId,
          leaseToken: item.leaseToken,
          kind: "expand",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              {
                slug: "cli",
                title: "CLI",
                type: "module",
                op: "upsert",
                body: "CLI surface",
                anchors: [{ path: "README.md", startLine: 1, locatorOffset: 0 }],
              },
            ],
            children: ["cli"],
          }),
        },
      ],
    }),
  });
  expect(done.exitCode).toBe(0);
}

describe("map metric", () => {
  test("sets floats; rejects OOB and missing levels; drops can decay parent", async () => {
    const repo = makeGitRepo();
    await seedRootChild(repo);

    const none = await snowshoe(repo, ["map", "metric", "--json", "--slug", "cli"]);
    expect(none.exitCode).not.toBe(0);

    const bad = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--overview",
      "1.5",
    ]);
    expect(bad.exitCode).not.toBe(0);

    const negEq = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--overview=-0.1",
    ]);
    expect(negEq.exitCode).not.toBe(0);
    expect(String(negEq.json.error)).toMatch(/\[0, 1\]/);

    const negSpace = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--overview",
      "-0.1",
    ]);
    expect(negSpace.exitCode).not.toBe(0);
    expect(String(negSpace.json.error)).toMatch(/\[0, 1\]/);

    const negSkipped = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--overview",
      "-0.2",
      "--contracts",
      "0.5",
    ]);
    expect(negSkipped.exitCode).not.toBe(0);
    expect(String(negSkipped.json.error)).toMatch(/\[0, 1\]/);

    const setHigh = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--overview",
      "0.9",
      "--contracts",
      "0.8",
      "--internals",
      "0.7",
    ]);
    expect(setHigh.exitCode).toBe(0);
    expect(setHigh.json.command).toBe("map.metric");
    const afterHigh = setHigh.json.after as Record<string, number>;
    expect(afterHigh.overview).toBe(0.9);
    expect(afterHigh.contracts).toBe(0.8);
    expect(afterHigh.internals).toBe(0.7);

    await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "root",
      "--overview",
      "0.95",
      "--contracts",
      "0.95",
      "--internals",
      "0.95",
    ]);

    const drop = await snowshoe(repo, [
      "map",
      "metric",
      "--json",
      "--slug",
      "cli",
      "--contracts",
      "0.2",
    ]);
    expect(drop.exitCode).toBe(0);

    const status = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--slug",
      "root",
      "--all-fields",
    ]);
    const root = (
      status.json.nodes as Array<{ slug: string; metrics?: Record<string, number> }>
    ).find((n) => n.slug === "root");
    expect(root?.metrics?.contracts).toBe(0.2);
    expect(root?.metrics?.overview).toBe(0.95);
  });
});
