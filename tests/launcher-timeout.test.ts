import { describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { fetchOvenBunTarball, formatFetchReason } from "../bin/resolve-bun.js";

describe("Bun fetch timeout", () => {
  test("unreachable registry aborts within the bound and returns a short reason", async () => {
    const server = createServer((_socket) => {
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
    expect(message).not.toMatch(/at \S+ \(/);
    expect(message.toLowerCase()).not.toContain("npm err!");
    expect(elapsed).toBeLessThan(8000);
  });
});
