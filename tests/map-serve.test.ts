import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureMapUiBuilt,
  isMapUiDistStale,
  snowshoePackageRoot,
  startMapServer,
} from "../src/map/serve.ts";
import { commitFile, completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

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
        payload: detailPayload({
          parentSlug: "root",
          nodes: [
            {
              slug: "auth",
              title: "Auth",
              type: "module",
              op: "upsert",
              anchors: [{ path: "README.md", symbol: "fixture", startLine: 1 }],
            },
          ],
        }),
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

    const cli = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
    const httpRes = await fetch(`${server.url}api/map/status?allFields=1`);
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

    const treeHttp = await fetch(
      `${server.url}api/map/status?fields=slug,title,type,leaf,children,refs&slug=auth&depth=0`,
    );
    expect(treeHttp.ok).toBe(true);
    const treeJson = (await treeHttp.json()) as {
      fields?: string[];
      nodes: Array<{ slug: string }>;
    };
    expect(treeJson.fields).toEqual(["slug", "title", "type", "leaf", "children", "refs"]);
    expect(treeJson.nodes.map((n) => n.slug)).toEqual(["auth"]);

    const nbHttp = await fetch(
      `${server.url}api/map/status?fields=slug,title,type,leaf,children,refs&slug=auth&neighborhood=1`,
    );
    expect(nbHttp.ok).toBe(true);
    const nbJson = (await nbHttp.json()) as { neighborhood?: boolean; edges: unknown[] };
    expect(nbJson.neighborhood).toBe(true);
    expect(Array.isArray(nbJson.edges)).toBe(true);

    const sess = await fetch(`${server.url}api/session`);
    const sessJson = (await sess.json()) as {
      repoRoot: string;
      locale: string | null;
      expandDepth: number;
    };
    expect(sessJson.repoRoot).toBe(repo);
    expect(sessJson.locale).toBeNull();
    expect(sessJson.expandDepth).toBe(1);

    const mark = await fetch(`${server.url}api/map/detail/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "auth" }),
    });
    expect(mark.ok).toBe(true);
    const markJson = (await mark.json()) as { status: string; command: string };
    expect(markJson.command).toBe("map.detail.mark");
    expect(markJson.status).toBe("pending");

    const pending = await fetch(`${server.url}api/map/status?allFields=1`);
    const pendingJson = (await pending.json()) as { nodes: Array<Record<string, unknown>> };
    expect(pendingJson.nodes.find((n) => n.slug === "auth")?.detailStatus).toBe("pending");

    const cliPending = await snowshoe(repo, ["map", "status", "--json", "--all-fields"]);
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

    const after = await fetch(`${server.url}api/map/status?allFields=1`);
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
    expect(js).not.toContain('from"prism-react-renderer"');
    expect(js).not.toContain('from"@xterm/xterm"');
    expect(js).toContain("Reload · updated");
    expect(js).toContain("Map changed");
    expect(js).toContain("/api/map/status");
    expect(js).toContain("/api/map/detail/mark");
    expect(js).toContain("/api/file");
    expect(js).toContain("Code preview");
    expect(js).toContain("Open in editor");
    expect(js).toContain("vscode://file");
    expect(js).toContain("No entity body yet");
    expect(js).toContain("No refs on this node");
    expect(js).toContain("Preview in UI");
    expect(js).toContain("/api/view");
    expect(js).toContain("Location");
    expect(js).not.toContain("Dumb client");
    expect(js).not.toContain("prose: ");
    expect(js).not.toContain("ledger.sqlite");
    expect(js).not.toContain("work complete");
  });

  test("isMapUiDistStale is true when dist is missing or older than ui/src", () => {
    const root = mkdtempSync(join(tmpdir(), "snowshoe-ui-stale-"));
    mkdirSync(join(root, "ui", "src"), { recursive: true });
    mkdirSync(join(root, "ui", "dist"), { recursive: true });
    writeFileSync(join(root, "ui", "index.html"), "<html></html>\n");
    writeFileSync(join(root, "ui", "vite.config.ts"), "export default {}\n");
    writeFileSync(join(root, "package.json"), "{}\n");
    writeFileSync(join(root, "ui", "src", "App.tsx"), "export {}\n");
    writeFileSync(join(root, "ui", "dist", "index.html"), "<html></html>\n");

    const old = new Date("2020-01-01T00:00:00Z");
    const neu = new Date("2026-09-27T00:00:00Z");
    utimesSync(join(root, "ui", "dist", "index.html"), old, old);
    utimesSync(join(root, "ui", "src", "App.tsx"), neu, neu);
    expect(isMapUiDistStale(root)).toBe(true);

    utimesSync(join(root, "ui", "dist", "index.html"), neu, neu);
    utimesSync(join(root, "ui", "src", "App.tsx"), old, old);
    utimesSync(join(root, "ui", "index.html"), old, old);
    utimesSync(join(root, "ui", "vite.config.ts"), old, old);
    utimesSync(join(root, "package.json"), old, old);
    expect(isMapUiDistStale(root)).toBe(false);

    writeFileSync(
      join(root, "ui", "dist", "index.html"),
      `<script type="module" src="/src/main.tsx"></script>\n`,
    );
    expect(isMapUiDistStale(root)).toBe(true);
  });

  test("GET /api/session expandDepth follows map serve option (default 1)", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
      expandDepth: 2,
    });
    stop = server.stop;
    const sess = await fetch(`${server.url}api/session`);
    const body = (await sess.json()) as { expandDepth: number; packageRoot: string };
    expect(body.expandDepth).toBe(2);
    expect(body.packageRoot).toBe(snowshoePackageRoot());

    const missingJs = await fetch(`${server.url}assets/missing-hash.js`);
    expect(missingJs.status).toBe(404);
    expect(missingJs.headers.get("content-type") ?? "").not.toContain("text/html");

    const viteDev = await fetch(`${server.url}src/main.tsx`);
    expect(viteDev.status).toBe(404);
  });

  test("GET /api/session mapAnchor is epoch target; refreshRequired when HEAD moves", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;

    const cold = (await (await fetch(`${server.url}api/session`)).json()) as {
      gitHead: string;
      mapAnchor: string | null;
      refreshRequired: boolean;
    };
    expect(cold.mapAnchor).toBe(cold.gitHead);
    expect(cold.refreshRequired).toBe(false);

    commitFile(repo, "ahead.md", "one\n", "head ahead of caught_up_base");
    const drifted = (await (await fetch(`${server.url}api/session`)).json()) as {
      gitHead: string;
      mapAnchor: string | null;
      refreshRequired: boolean;
    };
    expect(drifted.refreshRequired).toBe(true);
    expect(drifted.mapAnchor).toBe(cold.mapAnchor);
    expect(drifted.gitHead).not.toBe(drifted.mapAnchor);

    const refreshed = await snowshoe(repo, ["routine", "refresh", "--json"]);
    expect(refreshed.json.action).toBe("opened");
    const bound = (await (await fetch(`${server.url}api/session`)).json()) as {
      gitHead: string;
      mapAnchor: string | null;
      refreshRequired: boolean;
    };
    expect(bound.mapAnchor).toBe(bound.gitHead);
    expect(bound.refreshRequired).toBe(false);
    expect(bound.mapAnchor).toBe(drifted.gitHead);
  });

  test("in-memory GET/PUT /api/view is per id and not the ledger session", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;

    const created = await fetch(`${server.url}api/view`, { method: "POST" });
    expect(created.ok).toBe(true);
    const createdJson = (await created.json()) as { id: string; slug: string | null };
    expect(createdJson.id).toBeTruthy();
    expect(createdJson.slug).toBeNull();

    const missing = await fetch(`${server.url}api/view/not-a-real-id`);
    expect(missing.status).toBe(404);

    const put = await fetch(`${server.url}api/view/${createdJson.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "root" }),
    });
    expect(put.ok).toBe(true);
    const got = await fetch(`${server.url}api/view/${createdJson.id}`);
    const gotJson = (await got.json()) as { slug: string | null; repoRoot?: string };
    expect(gotJson.slug).toBe("root");
    expect(gotJson.repoRoot).toBe(repo);

    const sess = await fetch(`${server.url}api/session`);
    const sessJson = (await sess.json()) as { repoRoot?: string; slug?: string };
    expect(sessJson.repoRoot).toBe(repo);
    expect(sessJson.slug).toBeUndefined();
  });

  test("map view needs env or flags; --json reads live RAM view", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const missing = await snowshoe(repo, ["map", "view", "--json"], {
      env: { SNOWSHOE_MAP_URL: "", SNOWSHOE_VIEW: "" },
    });
    expect(missing.exitCode).toBe(2);
    expect(String(missing.json.error)).toMatch(/SNOWSHOE_MAP_URL/);

    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const created = await fetch(`${server.url}api/view`, { method: "POST" });
    const createdJson = (await created.json()) as { id: string };
    await fetch(`${server.url}api/view/${createdJson.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "root" }),
    });
    const viewed = await snowshoe(repo, ["map", "view", "--json"], {
      env: { SNOWSHOE_MAP_URL: server.url.replace(/\/$/, ""), SNOWSHOE_VIEW: createdJson.id },
    });
    expect(viewed.exitCode).toBe(0);
    expect(viewed.json.command).toBe("map.view");
    expect(viewed.json.slug).toBe("root");
    expect(viewed.json.id).toBe(createdJson.id);
    expect(viewed.json.repoRoot).toBe(repo);

    const viaFlags = await snowshoe(
      repo,
      ["map", "view", "--json", "--url", server.url.replace(/\/$/, ""), "--id", createdJson.id],
      { env: { SNOWSHOE_MAP_URL: "", SNOWSHOE_VIEW: "" } },
    );
    expect(viaFlags.exitCode).toBe(0);
    expect(viaFlags.json.slug).toBe("root");
  });
});
