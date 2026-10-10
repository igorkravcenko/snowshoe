import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { makeGitRepo } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");
const LAUNCHER = join(ROOT, "bin/snowshoe.js");

describe("launcher signals", () => {
  test("SIGINT through the Node launcher exits 128+SIGINT (130), not 0", async () => {
    const repo = makeGitRepo();
    const proc = Bun.spawn(["node", LAUNCHER, "map", "serve", "--port", "0"], {
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
    const decoder = new TextDecoder();
    let buf = "";
    const reader = proc.stdout.getReader();
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !buf.includes('"url"')) {
      const next = await reader.read();
      if (next.value) buf += decoder.decode(next.value, { stream: true });
      if (next.done) break;
    }
    expect(buf).toContain('"url"');
    proc.kill("SIGINT");
    const code = await proc.exited;
    expect(code).not.toBe(0);
    expect(code).toBe(130);
  }, 20_000);
});
