import { describe, expect, test } from "bun:test";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedRootChild(repo: string, slug: string, title: string): Promise<void> {
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
          nodes: [{ slug, title, type: "module", op: "upsert" }],
        }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("map status fields / slug / depth", () => {
  test("default is slug+children; --all-fields has bodyMd; --slug is one node", async () => {
    const repo = makeGitRepo();
    await seedRootChild(repo, "auth", "Auth");
    const slim = await snowshoe(repo, ["map", "status", "--json"]);
    expect(slim.exitCode).toBe(0);
    expect(slim.json.fields).toEqual(["slug", "children"]);
    const slimNodes = slim.json.nodes as Array<Record<string, unknown>>;
    expect(slimNodes.every((n) => !("bodyMd" in n) && !("title" in n))).toBe(true);
    expect(slimNodes.map((n) => n.slug).sort()).toEqual(["auth", "root"]);

    const full = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
    expect(full.exitCode).toBe(0);
    expect(full.json.fields).toBeUndefined();
    const fullNodes = full.json.nodes as Array<Record<string, unknown>>;
    expect(fullNodes.some((n) => "bodyMd" in n)).toBe(true);

    const tree = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--fields",
      "slug,title,type,leaf,children,refs",
    ]);
    expect(tree.exitCode).toBe(0);
    expect(tree.json.fields).toEqual(["slug", "title", "type", "leaf", "children", "refs"]);
    const treeNodes = tree.json.nodes as Array<Record<string, unknown>>;
    expect(treeNodes.every((n) => !("bodyMd" in n) && !("anchors" in n))).toBe(true);

    const self = await snowshoe(repo, ["map", "status", "--json", "--slug", "auth"]);
    expect(self.exitCode).toBe(0);
    expect(self.json.focusSlug).toBe("auth");
    const selfSlugs = (self.json.nodes as Array<{ slug: string }>).map((n) => n.slug);
    expect(selfSlugs).toEqual(["auth"]);

    const both = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--all-fields",
      "--fields",
      "slug,children",
    ]);
    expect(both.exitCode).not.toBe(0);
  });

  test("neighborhood requires slug and returns edges", async () => {
    const repo = makeGitRepo();
    await seedRootChild(repo, "auth", "Auth");
    const bad = await snowshoe(repo, ["map", "status", "--json", "--neighborhood"]);
    expect(bad.exitCode).not.toBe(0);

    const graph = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--fields",
      "slug,title,type,leaf,children,refs",
      "--neighborhood",
      "--slug",
      "auth",
    ]);
    expect(graph.exitCode).toBe(0);
    expect(graph.json.neighborhood).toBe(true);
    expect(graph.json.fields).toEqual(["slug", "title", "type", "leaf", "children", "refs"]);
    expect(graph.json.focusSlug).toBe("auth");
    const edges = graph.json.edges as Array<{ from: string; to: string; kind: string }>;
    expect(edges.some((e) => e.from === "root" && e.to === "auth" && e.kind === "parent")).toBe(
      true,
    );

    const mix = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--neighborhood",
      "--slug",
      "auth",
      "--depth",
      "1",
    ]);
    expect(mix.exitCode).not.toBe(0);
  });

  test("depth without slug is from root", async () => {
    const repo = makeGitRepo();
    await seedRootChild(repo, "auth", "Auth");
    const r = await snowshoe(repo, ["map", "status", "--json", "--depth", "1"]);
    expect(r.exitCode).toBe(0);
    const slugs = (r.json.nodes as Array<{ slug: string }>).map((n) => n.slug).sort();
    expect(slugs).toEqual(["auth", "root"]);
    expect(r.json.focusSlug).toBeUndefined();
  });
});
