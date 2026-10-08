import { afterEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { mapAccessTokensEqual } from "../src/map/access-token.ts";
import { type PtyWsData, tryUpgradeMapPty } from "../src/map/pty.ts";
import { startMapServer } from "../src/map/serve.ts";
import { makeGitRepo, mapApi, snowshoe } from "./helpers.ts";

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

function mockPtyServer(opts: {
  ip?: string | null;
  port?: number;
  upgrade?: (req: Request) => boolean;
}): Server<PtyWsData> {
  return {
    requestIP: () => (opts.ip === null ? null : { address: opts.ip ?? "127.0.0.1" }),
    upgrade: opts.upgrade ?? (() => true),
    port: opts.port ?? 3232,
  } as unknown as Server<PtyWsData>;
}

describe("map serve CSRF / CSWSH guards", () => {
  test("uiUrl puts a per-launch token in the fragment; API base has no token", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    expect(server.token.length).toBeGreaterThanOrEqual(32);
    expect(server.uiUrl).toContain(`#t=${server.token}`);
    expect(server.url).not.toContain(server.token);
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

    const page = await fetch(server.uiUrl);
    expect(page.ok).toBe(true);
    expect(page.headers.get("x-frame-options")).toBe("DENY");
  });

  test("missing token is 401 on /api including file reads", async () => {
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
    for (const path of ["api/session", "api/map/status", "api/file?path=README.md&start=1&end=1"]) {
      const res = await fetch(`${server.url}${path}`);
      expect(res.status).toBe(401);
    }
    const viaQuery = await fetch(`${server.url}api/session?t=${encodeURIComponent(server.token)}`);
    expect(viaQuery.status).toBe(401);
  });

  test("wrong token is 401", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const res = await fetch(`${server.url}api/session`, {
      headers: { Authorization: "Bearer totally-not-the-token" },
    });
    expect(res.status).toBe(401);
  });

  test("foreign Origin is 403 even with a valid token", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const res = await fetch(`${server.url}api/session`, {
      headers: {
        Authorization: `Bearer ${server.token}`,
        Origin: "https://evil.example",
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(String(body.error)).toMatch(/Origin/i);
  });

  test("Sec-Fetch-Site: cross-site is 403 even with a valid token", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const res = await fetch(`${server.url}api/session`, {
      headers: {
        Authorization: `Bearer ${server.token}`,
        "Sec-Fetch-Site": "cross-site",
      },
    });
    expect(res.status).toBe(403);
  });

  test("same-origin Origin + token still works (UI flow)", async () => {
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
    const origin = `http://127.0.0.1:${server.port}`;
    const sess = await fetch(`${server.url}api/session`, {
      headers: {
        Authorization: `Bearer ${server.token}`,
        Origin: origin,
        "Sec-Fetch-Site": "same-origin",
      },
    });
    expect(sess.status).toBe(200);
    const created = await fetch(`${server.url}api/view`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.token}`,
        Origin: origin,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(created.ok).toBe(true);
    const localhostOrigin = await fetch(`${server.url}api/session`, {
      headers: {
        Authorization: `Bearer ${server.token}`,
        Origin: `http://localhost:${server.port}`,
      },
    });
    expect(localhostOrigin.status).toBe(200);
    const v6Origin = await fetch(`${server.url}api/session`, {
      headers: {
        Authorization: `Bearer ${server.token}`,
        Origin: `http://[::1]:${server.port}`,
      },
    });
    expect(v6Origin.status).toBe(200);
  });

  test("wrong Content-Type on POST is 415; JSON still writes", async () => {
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
    const form = await mapApi(server, "api/feedback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "text=csrf",
    });
    expect(form.status).toBe(415);
    const missing = await mapApi(server, "api/feedback", {
      method: "POST",
      body: JSON.stringify({ text: "csrf" }),
    });
    expect(missing.status).toBe(415);
    const ok = await mapApi(server, "api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "legit" }),
    });
    expect(ok.status).toBe(200);
  });

  test("foreign Origin WebSocket upgrade is rejected; missing Origin and missing token too", () => {
    const token = "A".repeat(43);
    const cwd = "/tmp";
    const base = `http://127.0.0.1:3232/api/pty?v=x&t=${token}`;
    let upgraded = 0;
    const server = mockPtyServer({
      upgrade: () => {
        upgraded += 1;
        return true;
      },
    });

    const foreign = tryUpgradeMapPty(
      new Request(base, {
        headers: {
          Host: "127.0.0.1:3232",
          Origin: "https://evil.example",
          Upgrade: "websocket",
        },
      }),
      server,
      cwd,
      { token, port: 3232 },
    );
    expect(foreign?.status).toBe(403);
    expect(upgraded).toBe(0);

    const missingOrigin = tryUpgradeMapPty(
      new Request(base, {
        headers: { Host: "127.0.0.1:3232", Upgrade: "websocket" },
      }),
      server,
      cwd,
      { token, port: 3232 },
    );
    expect(missingOrigin?.status).toBe(403);

    const missingToken = tryUpgradeMapPty(
      new Request("http://127.0.0.1:3232/api/pty?v=x", {
        headers: {
          Host: "127.0.0.1:3232",
          Origin: "http://127.0.0.1:3232",
          Upgrade: "websocket",
        },
      }),
      server,
      cwd,
      { token, port: 3232 },
    );
    expect(missingToken?.status).toBe(401);

    const ok = tryUpgradeMapPty(
      new Request(base, {
        headers: {
          Host: "127.0.0.1:3232",
          Origin: "http://127.0.0.1:3232",
          Upgrade: "websocket",
        },
      }),
      server,
      cwd,
      { token, port: 3232 },
    );
    expect(ok).toBeUndefined();
    expect(upgraded).toBe(1);
  });

  test("live PTY: foreign Origin cannot upgrade; same-origin + token can", async () => {
    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const origin = `http://127.0.0.1:${server.port}`;
    const wsUrl = `ws://127.0.0.1:${server.port}/api/pty?v=csrf&t=${encodeURIComponent(server.token)}`;

    const evil = new WebSocket(wsUrl, { headers: { Origin: "https://evil.example" } } as never);
    const evilClose = await new Promise<{ code?: number; opened: boolean }>((resolve) => {
      const timer = setTimeout(() => resolve({ opened: evil.readyState === WebSocket.OPEN }), 1500);
      evil.addEventListener("open", () => {
        clearTimeout(timer);
        resolve({ opened: true });
      });
      evil.addEventListener("close", (ev) => {
        clearTimeout(timer);
        resolve({ opened: false, code: ev.code });
      });
      evil.addEventListener("error", () => {
        /* close follows */
      });
    });
    expect(evilClose.opened).toBe(false);
    try {
      evil.close();
    } catch {
      /* already */
    }

    const good = new WebSocket(wsUrl, { headers: { Origin: origin } } as never);
    const welcome = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PTY open timeout")), 3000);
      const chunks: string[] = [];
      good.addEventListener("open", () => {
        /* wait for motd */
      });
      good.addEventListener("message", (ev) => {
        chunks.push(
          typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer),
        );
        const text = chunks.join("");
        if (text.includes("snowshoe skill")) {
          clearTimeout(timer);
          resolve(text);
        }
      });
      good.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("PTY socket error"));
      });
    });
    expect(welcome).toContain("snowshoe skill");
    good.close();
  });

  test("map view without SNOWSHOE_MAP_TOKEN fails; with token matches UI view", async () => {
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
    const created = await mapApi(server, "api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { id } = (await created.json()) as { id: string };
    await mapApi(server, `api/view/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "root" }),
    });
    const denied = await snowshoe(repo, ["map", "view", "--json"], {
      env: {
        SNOWSHOE_MAP_URL: server.url.replace(/\/$/, ""),
        SNOWSHOE_VIEW: id,
        SNOWSHOE_MAP_TOKEN: "",
      },
    });
    expect(denied.exitCode).not.toBe(0);
    expect(String(denied.json.error)).toMatch(/token/i);
  });
});

describe("mapAccessTokensEqual", () => {
  test("matches equal secrets and rejects length mismatch", () => {
    expect(mapAccessTokensEqual("abc", "abc")).toBe(true);
    expect(mapAccessTokensEqual("abc", "abd")).toBe(false);
    expect(mapAccessTokensEqual("abc", "ab")).toBe(false);
    expect(mapAccessTokensEqual("", "")).toBe(false);
  });
});
