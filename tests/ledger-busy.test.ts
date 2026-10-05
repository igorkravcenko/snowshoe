import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Ledger } from "../src/db/ledger.ts";
import { ledgerPath } from "../src/paths.ts";
import { CLI, makeGitRepo, snowshoe } from "./helpers.ts";

describe("ledger sqlite busy", () => {
  test("opening Ledger waits out a brief exclusive lock", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const path = ledgerPath(repo);
    const holder = Bun.spawn(
      [
        "bun",
        "-e",
        `
          import { Database } from "bun:sqlite";
          const db = new Database(${JSON.stringify(path)});
          db.exec("BEGIN EXCLUSIVE");
          await Bun.sleep(350);
          db.exec("COMMIT");
          db.close();
        `,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    await Bun.sleep(40);
    const t0 = Date.now();
    const ledger = new Ledger(repo, path);
    ledger.close();
    expect(Date.now() - t0).toBeLessThan(4000);
    expect(await holder.exited).toBe(0);
  });

  test("work next --wait does not exit 3 when wake races a writer", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: JSON.stringify({
        schemaVersion: 1,
        completions: [
          {
            id: String(item.stepId),
            leaseToken: String(item.leaseToken),
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
                  body: "fixture",
                  anchors: [{ path: "README.md", startLine: 1, locatorOffset: 0 }],
                },
              ],
              children: ["auth"],
              refs: [],
            },
          },
        ],
      }),
    });
    expect(done.exitCode).toBe(0);
    expect((await snowshoe(repo, ["work", "next", "--json"])).json.action).toBe("idle");

    const waiter = Bun.spawn(
      ["bun", CLI, "work", "next", "--json", "--wait", "--wait-timeout", "8000"],
      { cwd: repo, stdout: "pipe", stderr: "pipe" },
    );
    await Bun.sleep(250);
    const path = ledgerPath(repo);
    const holder = new Database(path);
    holder.exec("BEGIN EXCLUSIVE");
    const markP = snowshoe(repo, ["map", "detail", "mark", "--slug", "auth", "--json"]);
    await Bun.sleep(200);
    holder.exec("COMMIT");
    holder.close();
    const mark = await markP;
    expect(mark.exitCode).toBe(0);
    const stdout = await new Response(waiter.stdout).text();
    expect(await waiter.exited).toBe(0);
    const json = JSON.parse(stdout) as { action: string; error?: string };
    expect(json.error).toBeUndefined();
    expect(json.action).toBe("work");
  });
});
