import { afterEach, describe, expect, test } from "bun:test";
import { ensureMapUiBuilt, snowshoePackageRoot, startMapServer } from "../src/map/serve.ts";
import { completeEnvelope, makeGitRepo, snowshoe } from "./helpers.ts";

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

async function seedAuth(repo: string): Promise<void> {
  await snowshoe(repo, ["init", "--json"]);
  const next = await snowshoe(repo, ["work", "next", "--json"]);
  const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
  const done = await snowshoe(repo, ["work", "complete", "--json"], {
    stdin: completeEnvelope([
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
              anchors: [{ path: "README.md", symbol: "fixture", startLine: 1 }],
            },
          ],
          edges: [{ from: "root", to: "auth", kind: "parent" }],
        },
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("map serve HTTP twins (same read/mutation layer as CLI)", () => {
  test("GET /api/map/status matches CLI map status shape; mark/cancel via POST", async () => {
    const repo = makeGitRepo();
    await seedAuth(repo);

    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;

    const cli = await snowshoe(repo, ["map", "status", "--json"]);
    const httpRes = await fetch(`${server.url}api/map/status`);
    expect(httpRes.ok).toBe(true);
    const httpJson = (await httpRes.json()) as Record<string, unknown>;
    expect(httpJson.rootSlug).toBe("root");
    expect(httpJson.rootSlug).toBe(cli.json.rootSlug);
    const httpNodes = httpJson.nodes as Array<Record<string, unknown>>;
    const cliNodes = cli.json.nodes as Array<Record<string, unknown>>;
    expect(httpNodes.map((n) => n.slug).sort()).toEqual(cliNodes.map((n) => n.slug).sort());
    const authHttp = httpNodes.find((n) => n.slug === "auth")!;
    expect(authHttp.detailStatus).toBeNull();
    expect((authHttp.anchors as Array<Record<string, unknown>>)[0]?.path).toBe("README.md");

    const sess = await fetch(`${server.url}api/session`);
    const sessJson = (await sess.json()) as { repoRoot: string };
    expect(sessJson.repoRoot).toBe(repo);

    const mark = await fetch(`${server.url}api/map/detail/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "auth" }),
    });
    expect(mark.ok).toBe(true);
    const markJson = (await mark.json()) as { status: string; command: string };
    expect(markJson.command).toBe("map.detail.mark");
    expect(markJson.status).toBe("pending");

    const pending = await fetch(`${server.url}api/map/status`);
    const pendingJson = (await pending.json()) as { nodes: Array<Record<string, unknown>> };
    expect(pendingJson.nodes.find((n) => n.slug === "auth")?.detailStatus).toBe("pending");

    const cliPending = await snowshoe(repo, ["map", "status", "--json"]);
    const cliAuth = (cliPending.json.nodes as Array<Record<string, unknown>>).find(
      (n) => n.slug === "auth",
    )!;
    expect(cliAuth.detailStatus).toBe("pending");

    const cancel = await fetch(`${server.url}api/map/detail/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "auth" }),
    });
    expect(cancel.ok).toBe(true);

    const after = await fetch(`${server.url}api/map/status`);
    const afterJson = (await after.json()) as { nodes: Array<Record<string, unknown>> };
    expect(afterJson.nodes.find((n) => n.slug === "auth")?.detailStatus).toBeNull();
  });

  test("UI smoke: built index mentions Snowshoe map and reload", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await ensureMapUiBuilt(snowshoePackageRoot());
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const page = await fetch(server.url);
    expect(page.ok).toBe(true);
    const html = await page.text();
    expect(html).toMatch(/Snowshoe map|id="root"/);
    const asset = html.match(/src="(\/assets\/[^"]+)"/);
    expect(asset?.[1]).toBeTruthy();
    const jsRes = await fetch(`${server.url.replace(/\/$/, "")}${asset![1]}`);
    expect(jsRes.ok).toBe(true);
    const js = await jsRes.text();
    expect(js).toContain("Reload");
    expect(js).toContain("/api/map/status");
    expect(js).toContain("/api/map/detail/mark");
    expect(js).toContain("vscode://file");
    expect(js).not.toContain("ledger.sqlite");
    expect(js).not.toContain("work complete");
  });
});
