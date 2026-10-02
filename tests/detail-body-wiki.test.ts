import { describe, expect, test } from "bun:test";
import { parseMarkKind } from "../src/domain/marks.ts";
import { canonicalMapHop } from "../src/domain/types.ts";
import { firstParagraph } from "../src/map/prose.ts";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

describe("firstParagraph / bodyOverview", () => {
  test("takes lead paragraph before blank line or heading", () => {
    expect(firstParagraph("Lead only.")).toBe("Lead only.");
    expect(firstParagraph("Overview line.\n\n## More\n\nDetail.")).toBe("Overview line.");
    expect(firstParagraph("One\ncontinued.\n\nTwo.")).toBe("One\ncontinued.");
    expect(firstParagraph("\n\n## Skip\n\nBody")).toBe("");
    expect(firstParagraph("Lead\n## Heading\nRest")).toBe("Lead");
  });
});

describe("detail hop is expand∪enrich", () => {
  test("parseMarkKind keeps detail; not aliased to expand", () => {
    expect(parseMarkKind("detail")).toBe("detail");
    expect(parseMarkKind("expand")).toBe("expand");
    expect(canonicalMapHop("detail")).toBe("detail");
    expect(canonicalMapHop("expand")).toBe("expand");
  });

  test("map detail mark queues detail; complete may add children and rewrite body", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const seed = (first.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(seed.stepId),
          leaseToken: String(seed.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                body: "Auth module stub.\n\n## Notes\n\nShort.",
              },
            ],
          }),
        },
      ]),
    });

    const mark = await snowshoe(repo, ["map", "detail", "mark", "--json", "--slug", "auth"]);
    expect(mark.exitCode).toBe(0);
    expect(mark.json.kind).toBe("detail");

    const status = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--all-fields",
      "--slug",
      "auth",
    ]);
    const auth = (status.json.nodes as Array<Record<string, unknown>>)[0]!;
    expect(auth.marks).toEqual(["detail"]);
    expect(auth.bodyOverview).toBe("Auth module stub.");
    expect(String(auth.bodyMd)).toContain("## Notes");

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("detail");
    expect(item.allowedChildTypes).toEqual(["module", "surface", "flow"]);

    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                body: "Rewritten overview for Auth.\n\n## Internals\n\nSession store.",
              },
              {
                slug: "login-flow",
                title: "Login",
                type: "flow",
                op: "upsert",
                body: "Login flow overview.\n\n## Steps\n\nValidate.",
              },
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
      "--fields",
      "slug,children,bodyOverview,bodyMd",
      "--depth",
      "1",
      "--slug",
      "auth",
    ]);
    const nodes = after.json.nodes as Array<Record<string, unknown>>;
    const parent = nodes.find((n) => n.slug === "auth")!;
    expect(parent.children).toEqual(["login-flow"]);
    expect(parent.bodyOverview).toBe("Rewritten overview for Auth.");
    expect(String(parent.bodyMd)).toContain("## Internals");
  });

  test("enrich still rejects children", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const first = await snowshoe(repo, ["work", "next", "--json"]);
    const seed = (first.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(seed.stepId),
          leaseToken: String(seed.leaseToken),
          kind: "expand",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "auth", title: "Auth", type: "module", op: "upsert" }],
          }),
        },
      ]),
    });
    await snowshoe(repo, ["map", "mark", "--json", "--slug", "auth", "--kind", "enrich"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("enrich");
    const bad = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "enrich",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              { slug: "auth", title: "Auth", type: "module", op: "upsert", body: "x" },
              { slug: "child", title: "Child", type: "flow", op: "upsert", body: "y" },
            ],
          }),
        },
      ]),
    });
    expect(bad.exitCode).not.toBe(0);
    const reasons = (bad.json.results as Array<{ reasons?: string[] }>)[0]?.reasons ?? [];
    expect(
      reasons.some((r) => r.includes("enrich_forbids") || r.includes("enrich_only_parent")),
    ).toBe(true);
  });
});
