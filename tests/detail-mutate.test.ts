import { describe, expect, test } from "bun:test";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

describe("detail complete mutate", () => {
  test("enrich parentSlug, retire child, reject unchanged_with_mutate", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (first.json.items as Array<Record<string, unknown>>)[0]!;
    const seeded = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              { slug: "auth", title: "Auth", type: "module", op: "upsert" },
              { slug: "cli", title: "CLI", type: "module", op: "upsert" },
            ],
          }),
        },
      ]),
    });
    expect(seeded.exitCode).toBe(0);

    const mark = await snowshoe(repo, ["map", "detail", "mark", "--json", "--slug", "root"]);
    expect(mark.exitCode).toBe(0);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const hop = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(hop.children).toEqual(["auth", "cli"]);

    const enrich = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hop.stepId),
          leaseToken: String(hop.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "root", title: "Repo", type: "module", op: "upsert" }],
            retire: ["cli"],
          }),
        },
      ]),
    });
    expect(enrich.exitCode).not.toBe(0);
    const reasons = (enrich.json.results as Array<{ reasons?: string[] }>)[0]?.reasons ?? [];
    expect(reasons.some((r) => r.startsWith("cannot_upsert_root"))).toBe(true);

    const retired = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hop.stepId),
          leaseToken: String(hop.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            retire: ["cli"],
          }),
        },
      ]),
    });
    expect(retired.exitCode).toBe(0);
    const map = await snowshoe(repo, ["map", "status", "--json"]);
    const slugs = (map.json.nodes as Array<{ slug: string }>).map((n) => n.slug);
    expect(slugs).toContain("auth");
    expect(slugs).not.toContain("cli");

    const markAuth = await snowshoe(repo, ["map", "detail", "mark", "--json", "--slug", "auth"]);
    expect(markAuth.exitCode).toBe(0);
    const nextAuth = await snowshoe(repo, ["work", "next", "--json"]);
    const authItem = (nextAuth.json.items as Array<Record<string, unknown>>)[0]!;
    const bodyUp = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(authItem.stepId),
          leaseToken: String(authItem.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              { slug: "auth", title: "Auth module", type: "module", op: "upsert", leaf: true },
            ],
          }),
        },
      ]),
    });
    expect(bodyUp.exitCode).toBe(0);
    const authRow = (
      (await snowshoe(repo, ["map", "status", "--json", "--all-fields"])).json.nodes as Array<
        Record<string, unknown>
      >
    ).find((n) => n.slug === "auth");
    expect(authRow?.title).toBe("Auth module");
    expect(authRow?.leaf).toBe(true);

    await snowshoe(repo, ["map", "detail", "mark", "--json", "--slug", "auth"]);
    const next3 = await snowshoe(repo, ["work", "next", "--json"]);
    const hop3 = (next3.json.items as Array<Record<string, unknown>>)[0]!;
    const mixed = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hop3.stepId),
          leaseToken: String(hop3.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            unchanged: true,
            retire: ["auth"],
          }),
        },
      ]),
    });
    expect(mixed.exitCode).not.toBe(0);
  });

  test("clearEdges unlinks a parent child without delete", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (first.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              { slug: "auth", title: "Auth", type: "module", op: "upsert" },
              { slug: "cli", title: "CLI", type: "module", op: "upsert" },
            ],
          }),
        },
      ]),
    });
    await snowshoe(repo, ["map", "detail", "mark", "--json", "--slug", "root"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const hop = (next.json.items as Array<Record<string, unknown>>)[0]!;
    const cleared = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(hop.stepId),
          leaseToken: String(hop.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            clearEdges: [{ from: "root", to: "cli", kind: "parent" }],
          }),
        },
      ]),
    });
    expect(cleared.exitCode).toBe(0);
    const tree = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--fields",
      "slug,children",
      "--slug",
      "root",
      "--depth",
      "1",
    ]);
    const root = (tree.json.nodes as Array<{ slug: string; children: string[] }>).find(
      (n) => n.slug === "root",
    );
    expect(root?.children).toEqual(["auth"]);
    const full = await snowshoe(repo, ["map", "status", "--json"]);
    const slugs = (full.json.nodes as Array<{ slug: string }>).map((n) => n.slug);
    expect(slugs).toContain("cli");
  });
});
