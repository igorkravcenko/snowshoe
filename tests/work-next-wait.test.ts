import { describe, expect, test } from "bun:test";
import { CLI, completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedIdleWithAuth(repo: string): Promise<void> {
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
  const idle = await snowshoe(repo, ["work", "next", "--json"]);
  expect(idle.json.action).toBe("idle");
}

describe("work next --wait", () => {
  test("without --wait, idle returns immediately and has no waitTimedOut", async () => {
    const repo = makeGitRepo();
    await seedIdleWithAuth(repo);
    const t0 = Date.now();
    const idle = await snowshoe(repo, ["work", "next", "--json"]);
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(idle.json.action).toBe("idle");
    expect(idle.json.waitTimedOut).toBeUndefined();
  });

  test("--wait-timeout on idle returns waitTimedOut without hanging forever", async () => {
    const repo = makeGitRepo();
    await seedIdleWithAuth(repo);
    const t0 = Date.now();
    const idle = await snowshoe(repo, [
      "work",
      "next",
      "--json",
      "--wait",
      "--wait-timeout",
      "250",
    ]);
    expect(idle.exitCode).toBe(0);
    expect(idle.json.action).toBe("idle");
    expect(idle.json.waitTimedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  test("--wait returns claimed detail after a later map detail mark", async () => {
    const repo = makeGitRepo();
    await seedIdleWithAuth(repo);

    const waiter = Bun.spawn(
      ["bun", CLI, "work", "next", "--json", "--wait", "--wait-timeout", "8000"],
      {
        cwd: repo,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    await Bun.sleep(300);
    const mark = await snowshoe(repo, ["map", "detail", "mark", "--slug", "auth", "--json"]);
    expect(mark.exitCode).toBe(0);
    const stdout = await new Response(waiter.stdout).text();
    const exitCode = await waiter.exited;
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout) as {
      action: string;
      items: Array<{ kind: string; parentSlug: string }>;
      waitTimedOut?: boolean;
    };
    expect(json.waitTimedOut).toBeUndefined();
    expect(json.action).toBe("work");
    expect(json.items[0]?.kind).toBe("detail");
    expect(json.items[0]?.parentSlug).toBe("auth");
  });
});
