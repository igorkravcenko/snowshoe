import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MAP_PORT,
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
              anchors: [{ path: "README.md", symbol: "fixture", startLine: 1, locatorOffset: 0 }],
            },
          ],
        }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

describe("map serve HTTP twins (same read/mutation layer as CLI)", () => {
  test("GET /api/feedback matches CLI feedback list", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    await snowshoe(repo, ["feedback", "add", "--json"], {
      stdin: JSON.stringify({ text: "http twin note" }),
    });
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const cli = await snowshoe(repo, ["feedback", "list", "--json"]);
    const httpRes = await fetch(`${server.url}api/feedback`);
    expect(httpRes.ok).toBe(true);
    const httpJson = (await httpRes.json()) as {
      entries: Array<{ text: string }>;
      command: string;
    };
    expect(httpJson.command).toBe("feedback.list");
    expect(httpJson.entries[0]?.text).toBe("http twin note");
    expect((cli.json.entries as Array<{ text: string }>)[0]?.text).toBe(httpJson.entries[0]?.text);
  });

  test("POST/DELETE /api/feedback twin add and remove", async () => {
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

    const added = await fetch(`${server.url}api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "from ui" }),
    });
    expect(added.ok).toBe(true);
    const addJson = (await added.json()) as { entry: { id: string; text: string } };
    expect(addJson.entry.text).toBe("from ui");

    const listed = await fetch(`${server.url}api/feedback`);
    const listJson = (await listed.json()) as { entries: Array<{ id: string }> };
    expect(listJson.entries.some((e) => e.id === addJson.entry.id)).toBe(true);

    const deleted = await fetch(
      `${server.url}api/feedback?id=${encodeURIComponent(addJson.entry.id)}`,
      { method: "DELETE" },
    );
    expect(deleted.ok).toBe(true);
    const after = await fetch(`${server.url}api/feedback`);
    const afterJson = (await after.json()) as { entries: Array<{ id: string }> };
    expect(afterJson.entries.some((e) => e.id === addJson.entry.id)).toBe(false);
  });

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

  test("UI smoke: built index mentions map chrome and reload", async () => {
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
    expect(html).toMatch(/id="root"/);
    expect(html).toMatch(/<title>map<\/title>/);
    const asset = html.match(/src="(\/assets\/[^"]+)"/);
    expect(asset?.[1]).toBeTruthy();
    const jsRes = await fetch(`${server.url.replace(/\/$/, "")}${asset![1]}`);
    expect(jsRes.ok).toBe(true);
    const js = await jsRes.text();
    expect(js).not.toContain('from"prism-react-renderer"');
    expect(js).not.toContain('from"@xterm/xterm"');
    expect(js).toContain("Reload · updated");
    expect(js).toContain("Map changed");
    expect(js).toContain(" map");
    expect(js).toContain("/api/map/status");
    expect(js).toContain("/api/map/mark");
    expect(js).toContain("/api/file");
    expect(js).toContain("/api/feedback");
    expect(js).toContain("Code preview");
    expect(js).toContain("Open in editor");
    expect(js).toContain("vscode://file");
    expect(js).toContain("No entity body yet");
    expect(js).toContain("No refs on this node");
    expect(js).toContain("No children yet");
    expect(js).toContain("Map not initialized");
    expect(js).toContain("snowshoe init");
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

  test("rejects non-loopback --host", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const viaCli = await snowshoe(repo, [
      "map",
      "serve",
      "--json",
      "--host",
      "0.0.0.0",
      "--port",
      "0",
    ]);
    expect(viaCli.exitCode).toBe(2);
    expect(String(viaCli.json.error)).toMatch(/loopback/i);

    await expect(
      startMapServer({
        cwd: repo,
        port: 0,
        hostname: "192.168.1.9",
        open: false,
        buildUi: false,
      }),
    ).rejects.toThrow(/loopback/i);
  });

  test("all /api/* reject non-loopback Host", async () => {
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
    const loopback = `127.0.0.1:${server.port}`;
    const evil = { headers: { Host: "evil.example" } };
    const good = { headers: { Host: loopback } };

    for (const path of ["api/map/status", "api/session", "api/file?path=README.md&start=1&end=1"]) {
      const bad = await fetch(`${server.url}${path}`, evil);
      expect(bad.status).toBe(403);
    }
    const badPost = await fetch(`${server.url}api/feedback`, {
      method: "POST",
      headers: { Host: "evil.example", "content-type": "application/json" },
      body: JSON.stringify({ text: "should not land" }),
    });
    expect(badPost.status).toBe(403);

    const statusOk = await fetch(`${server.url}api/map/status`, good);
    expect(statusOk.status).toBe(200);
    const fileOk = await fetch(`${server.url}api/file?path=README.md&start=1&end=1`, good);
    expect(fileOk.status).toBe(200);
    const feedbackOk = await fetch(`${server.url}api/feedback`, {
      method: "POST",
      headers: { Host: loopback, "content-type": "application/json" },
      body: JSON.stringify({ text: "host ok" }),
    });
    expect(feedbackOk.status).toBe(200);
  });

  test("soft-init: serve without .snowshoe boots; session/status uninitialized; mark fails gracefully", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;

    const sess = await fetch(`${server.url}api/session`);
    expect(sess.status).toBe(200);
    const sessJson = (await sess.json()) as {
      initialized: boolean;
      repoRoot: string;
      nodes?: unknown;
      hint?: string;
      cta?: string;
      expandDepth: number;
    };
    expect(sessJson.initialized).toBe(false);
    expect(sessJson.repoRoot).toBe(repo);
    expect(String(sessJson.hint ?? sessJson.cta)).toMatch(/snowshoe init/i);
    expect(sessJson.expandDepth).toBe(1);

    const status = await fetch(`${server.url}api/map/status?allFields=1`);
    expect(status.status).toBe(200);
    const statusJson = (await status.json()) as {
      initialized: boolean;
      rootSlug: string;
      nodes: unknown[];
      hint?: string;
    };
    expect(statusJson.initialized).toBe(false);
    expect(statusJson.rootSlug).toBe("root");
    expect(statusJson.nodes).toEqual([]);
    expect(String(statusJson.hint)).toMatch(/snowshoe init|skill/i);

    const mark = await fetch(`${server.url}api/map/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "root", kind: "detail" }),
    });
    expect(mark.status).toBe(400);
    const markJson = (await mark.json()) as { ok?: boolean; error?: string };
    expect(markJson.ok).toBe(false);
    expect(String(markJson.error)).toMatch(/snowshoe init/i);

    const file = await fetch(`${server.url}api/file?path=README.md&start=1&end=1`);
    expect(file.status).toBe(400);
    const fileJson = (await file.json()) as { error?: string };
    expect(String(fileJson.error)).toMatch(/snowshoe init/i);

    const created = await fetch(`${server.url}api/view`, { method: "POST" });
    expect(created.ok).toBe(true);

    // Host check still applies when uninitialized
    const evil = await fetch(`${server.url}api/session`, { headers: { Host: "evil.example" } });
    expect(evil.status).toBe(403);
  });

  test("soft-init: after init, session/status report initialized and match CLI", async () => {
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

    const sess = await fetch(`${server.url}api/session`);
    const sessJson = (await sess.json()) as { initialized: boolean; repoRoot: string };
    expect(sessJson.initialized).toBe(true);
    expect(sessJson.repoRoot).toBe(repo);

    const status = await fetch(`${server.url}api/map/status?allFields=1`);
    const statusJson = (await status.json()) as {
      initialized: boolean;
      rootSlug: string;
      nodes: Array<{ slug: string }>;
    };
    expect(statusJson.initialized).toBe(true);
    expect(statusJson.rootSlug).toBe("root");
    expect(statusJson.nodes.some((n) => n.slug === "root")).toBe(true);
  });

  test("DEFAULT_MAP_PORT is 3232", () => {
    expect(DEFAULT_MAP_PORT).toBe(3232);
  });
});
