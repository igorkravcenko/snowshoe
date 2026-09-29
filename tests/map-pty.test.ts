import { afterEach, describe, expect, test } from "bun:test";
import { spawnMapPtyShell } from "../src/map/pty.ts";

describe("map PTY shell", () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  function run(cwd = "/tmp") {
    const chunks: Buffer[] = [];
    const { terminal, proc } = spawnMapPtyShell({
      cwd,
      viewId: "test-view",
      mapUrl: "http://127.0.0.1:9",
      onData(chunk) {
        chunks.push(Buffer.from(chunk));
      },
    });
    stop = () => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      try {
        terminal.close();
      } catch {
        /* ignore */
      }
    };
    return { terminal, chunks };
  }

  test("interactive bash gets job control (no ioctl warning)", async () => {
    const { chunks } = run();
    await Bun.sleep(350);
    const out = Buffer.concat(chunks).toString();
    expect(out).not.toMatch(/cannot set terminal process group/);
    expect(out).not.toMatch(/no job control in this shell/);
  });

  test("prints a welcome and sets SNOWSHOE_MODE=learn", async () => {
    const { terminal, chunks } = run();
    await Bun.sleep(250);
    terminal.write("printenv SNOWSHOE_MODE\r");
    await Bun.sleep(250);
    const out = Buffer.concat(chunks).toString();
    expect(out).toContain("snowshoe skill");
    expect(out).toMatch(/learn/);
  });
});
