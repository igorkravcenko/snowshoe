import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchOvenBunTarball, formatFetchReason } from "../bin/resolve-bun.js";

describe("Bun fetch timeout", () => {
  test("unreachable registry aborts within the bound and returns a short reason", async () => {
    const server = createServer((_req, _res) => {
      // Accept and never respond (hangs HTTP clients until abort).
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const registry = `http://127.0.0.1:${addr.port}`;
    const started = Date.now();
    let err: unknown;
    try {
      await fetchOvenBunTarball({
        env: { npm_config_registry: registry },
        platform: "linux",
        arch: "x64",
        libc: "glibc",
        avx2: true,
        skipFiles: true,
        timeoutMs: 1500,
      });
    } catch (e) {
      err = e;
    } finally {
      server.close();
    }
    const elapsed = Date.now() - started;
    expect(err).toBeInstanceOf(Error);
    const message = err instanceof Error ? err.message : String(err);
    expect(formatFetchReason(err, 1500)).toMatch(/timed out|connection/i);
    expect(message).toMatch(/timed out|connection/i);
    expect(message).not.toMatch(/at \S+ \(/);
    expect(message.toLowerCase()).not.toContain("npm err!");
    expect(elapsed).toBeLessThan(8000);
  });

  test("headers then stalled body times out (deadline covers json/arrayBuffer)", async () => {
    const server = createServer((req, res) => {
      const url = req.url || "";
      if (url.includes(".tgz") || url.includes("stall")) {
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.write("x");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"dist":');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const registry = `http://127.0.0.1:${addr.port}`;
    const started = Date.now();
    let err: unknown;
    try {
      await fetchOvenBunTarball({
        env: { npm_config_registry: registry },
        platform: "linux",
        arch: "x64",
        libc: "glibc",
        avx2: true,
        skipFiles: true,
        timeoutMs: 1500,
      });
    } catch (e) {
      err = e;
    } finally {
      server.close();
    }
    const elapsed = Date.now() - started;
    expect(err).toBeInstanceOf(Error);
    const message = err instanceof Error ? err.message : String(err);
    expect(message).toMatch(/timed out after 2s|timed out after 1s/);
    expect(elapsed).toBeLessThan(8000);
  });

  test("dead proxy npm pack fails fast with a one-line reason", async () => {
    const cache = mkdtempSync(join(tmpdir(), "snowshoe-npmcache-"));
    const home = mkdtempSync(join(tmpdir(), "snowshoe-npmhome-"));
    const started = Date.now();
    let err: unknown;
    try {
      await fetchOvenBunTarball({
        env: {
          PATH: process.env.PATH,
          HOME: home,
          HTTPS_PROXY: "http://127.0.0.1:1",
          HTTP_PROXY: "http://127.0.0.1:1",
          https_proxy: "http://127.0.0.1:1",
          http_proxy: "http://127.0.0.1:1",
          npm_config_registry: "https://registry.npmjs.org",
          npm_config_cache: cache,
        },
        platform: "linux",
        arch: "x64",
        libc: "glibc",
        avx2: true,
        skipFiles: true,
        timeoutMs: 8000,
      });
    } catch (e) {
      err = e;
    }
    const elapsed = Date.now() - started;
    expect(err).toBeInstanceOf(Error);
    const message = err instanceof Error ? err.message : String(err);
    expect(message).toMatch(/npm (view|pack) .+ (failed|timed out)|npm not found/);
    expect(message).not.toMatch(/\n/);
    expect(message.toLowerCase()).not.toContain("npm err");
    expect(elapsed).toBeLessThan(20_000);
  }, 25_000);
});
