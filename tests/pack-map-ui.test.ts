import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canRebuildMapUi,
  ensureMapUiBuilt,
  isMapUiDistReady,
  isMapUiDistStale,
  startMapServer,
} from "../src/map/serve.ts";
import { makeGitRepo } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");

describe("packed npm install map UI", () => {
  test("tarball ships ui/dist; bun add tree serves it without vite even if mtimes look stale", async () => {
    const packDir = mkdtempSync(join(tmpdir(), "snowshoe-pack-"));
    const packed = Bun.spawnSync(
      ["bun", "pm", "pack", "--destination", packDir, "--filename", "snowshoe.tgz"],
      { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
    );
    if (packed.exitCode !== 0) {
      throw new Error(
        `bun pm pack failed: ${packed.stderr.toString() || packed.stdout.toString()}`,
      );
    }
    const tgz = join(packDir, "snowshoe.tgz");
    expect(existsSync(tgz)).toBe(true);

    const listing = Bun.spawnSync(["tar", "-tf", tgz], { stdout: "pipe", stderr: "pipe" });
    const files = listing.stdout.toString();
    expect(files).toContain("package/ui/dist/index.html");
    expect(files).not.toMatch(/package\/ui\/src\//);
    expect(files).not.toContain("package/ui/vite.config.ts");
    expect(files).not.toContain("package/ui/index.html");

    const app = mkdtempSync(join(tmpdir(), "snowshoe-installed-"));
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({ name: "snowshoe-pack-probe", version: "0.0.0", private: true }),
    );
    const add = Bun.spawnSync(["bun", "add", tgz], {
      cwd: app,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (add.exitCode !== 0) {
      throw new Error(`bun add tarball failed: ${add.stderr.toString() || add.stdout.toString()}`);
    }

    const installed = join(app, "node_modules/@igorkravcenko/snowshoe");
    expect(existsSync(join(installed, "ui", "dist", "index.html"))).toBe(true);
    expect(existsSync(join(installed, "ui", "src"))).toBe(false);
    expect(existsSync(join(installed, "ui", "vite.config.ts"))).toBe(false);
    expect(existsSync(join(installed, "node_modules", "vite"))).toBe(false);
    expect(canRebuildMapUi(installed)).toBe(false);
    expect(isMapUiDistReady(installed)).toBe(true);

    const distHtml = join(installed, "ui", "dist", "index.html");
    const pkgJson = join(installed, "package.json");
    const old = new Date("2020-01-01T00:00:00Z");
    const neu = new Date("2026-10-08T00:00:00Z");
    utimesSync(distHtml, old, old);
    utimesSync(pkgJson, neu, neu);
    expect(isMapUiDistStale(installed)).toBe(true);

    await ensureMapUiBuilt(installed);

    const repo = makeGitRepo();
    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      packageRoot: installed,
    });
    try {
      const page = await fetch(server.url);
      expect(page.ok).toBe(true);
      const html = await page.text();
      expect(html).toMatch(/id="root"/);
      expect(html).not.toContain("/src/main.tsx");
    } finally {
      server.stop();
    }
  }, 120_000);
});
