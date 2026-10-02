import { describe, expect, test } from "bun:test";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedRoot(repo: string): Promise<void> {
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
          nodes: [{ slug: "auth", title: "Auth", type: "module", op: "upsert" }],
        }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("HP2 user mark → detail one hop", () => {
  test("mark enqueues; complete upserts children; map updates; cancel pending", async () => {
    const repo = makeGitRepo();
    await seedRoot(repo);

    const mark = await snowshoe(repo, ["map", "detail", "mark", "--slug", "auth", "--json"]);
    expect(mark.exitCode).toBe(0);
    expect(mark.json.status).toBe("pending");

    const pendingMap = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
    const authPending = (pendingMap.json.nodes as Array<Record<string, unknown>>).find(
      (n) => n.slug === "auth",
    )!;
    expect(authPending.detailStatus).toBe("pending");
    expect(authPending.marks).toEqual(["detail"]);

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("detail");
    expect(item.parentSlug).toBe("auth");
    expect(item.allowedChildTypes).toEqual(["module", "surface", "flow"]);

    const complete = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "auth",
            nodes: [
              { slug: "auth-session", title: "Session", type: "module", op: "upsert" },
              { slug: "login-flow", title: "Login", type: "flow", op: "upsert" },
            ],
          }),
        },
      ]),
    });
    expect(complete.exitCode).toBe(0);

    const map = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
    const nodes = map.json.nodes as Array<Record<string, unknown>>;
    const auth = nodes.find((n) => n.slug === "auth")!;
    expect(auth.detailStatus).toBeNull();
    expect(auth.children).toEqual(expect.arrayContaining(["auth-session", "login-flow"]));
    expect(nodes.some((n) => n.slug === "auth-session")).toBe(true);

    const mark2 = await snowshoe(repo, [
      "map",
      "detail",
      "mark",
      "--slug",
      "auth-session",
      "--json",
    ]);
    expect(mark2.exitCode).toBe(0);
    const cancel = await snowshoe(repo, [
      "map",
      "detail",
      "cancel",
      "--slug",
      "auth-session",
      "--json",
    ]);
    expect(cancel.exitCode).toBe(0);
    const nextAfterCancel = await snowshoe(repo, ["work", "next", "--json"]);
    expect(nextAfterCancel.json.items).toEqual([]);
    expect(nextAfterCancel.json.stop).toBe(true);
    expect(nextAfterCancel.json.action).toBe("idle");
  });
});
