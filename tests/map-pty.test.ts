import { afterEach, describe, expect, test } from "bun:test";
import { spawnMapPtyShell } from "../src/map/pty.ts";

describe("map PTY shell", () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  test("interactive bash gets job control (no ioctl warning)", async () => {
    const chunks: Buffer[] = [];
    const { terminal, proc } = spawnMapPtyShell({
      cwd: "/tmp",
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
    await Bun.sleep(350);
    const out = Buffer.concat(chunks).toString();
    expect(out).not.toMatch(/cannot set terminal process group/);
    expect(out).not.toMatch(/no job control in this shell/);
  });
});
