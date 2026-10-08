import { afterEach, describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import {
  destroyAllPtySessionsForTests,
  hasPtySessionForTests,
  mapPtyWebsocket,
  PTY_MAX_SESSIONS,
  type PtyWsData,
  ptySessionCountForTests,
  spawnMapPtyShell,
} from "../src/map/pty.ts";

describe("map PTY shell", () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
    destroyAllPtySessionsForTests();
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

  test("sets SNOWSHOE_MAP_TOKEN when spawned with a token", async () => {
    const chunks: Buffer[] = [];
    const token = "pty-token-fixture-00000000000000000001";
    const { terminal, proc } = spawnMapPtyShell({
      cwd: "/tmp",
      viewId: "token-view",
      mapUrl: "http://127.0.0.1:9",
      token,
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
    await Bun.sleep(250);
    terminal.write("printenv SNOWSHOE_MAP_TOKEN\r");
    await Bun.sleep(250);
    const out = Buffer.concat(chunks).toString();
    expect(out).toContain(token);
  });
});

describe("map PTY session persistence", () => {
  afterEach(() => {
    destroyAllPtySessionsForTests();
  });

  function fakeWs(data: PtyWsData) {
    const sent: Uint8Array[] = [];
    const ws = {
      data,
      send(payload: string | ArrayBufferView | ArrayBuffer) {
        if (typeof payload === "string") {
          sent.push(new TextEncoder().encode(payload));
        } else if (payload instanceof ArrayBuffer) {
          sent.push(new Uint8Array(payload));
        } else {
          sent.push(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
        }
      },
      close() {},
    } as unknown as ServerWebSocket<PtyWsData>;
    return { ws, sent };
  }

  test("WS close keeps the shell; reattach replays buffer", async () => {
    const viewId = `persist-${crypto.randomUUID()}`;
    const data: PtyWsData = {
      viewId,
      mapUrl: "http://127.0.0.1:9",
      cwd: "/tmp",
      reset: false,
    };
    const first = fakeWs(data);
    mapPtyWebsocket.open(first.ws);
    await Bun.sleep(300);
    expect(hasPtySessionForTests(viewId)).toBe(true);

    mapPtyWebsocket.close(first.ws);
    expect(hasPtySessionForTests(viewId)).toBe(true);

    const second = fakeWs({ ...data, reset: false });
    mapPtyWebsocket.open(second.ws);
    await Bun.sleep(50);
    const replayed = Buffer.concat(second.sent.map((u) => Buffer.from(u))).toString();
    expect(replayed).toContain("snowshoe skill");
    expect(hasPtySessionForTests(viewId)).toBe(true);
  });

  test("reset=1 destroys the previous shell", async () => {
    const viewId = `reset-${crypto.randomUUID()}`;
    const data: PtyWsData = {
      viewId,
      mapUrl: "http://127.0.0.1:9",
      cwd: "/tmp",
      reset: false,
    };
    const first = fakeWs(data);
    mapPtyWebsocket.open(first.ws);
    await Bun.sleep(200);
    mapPtyWebsocket.close(first.ws);
    expect(hasPtySessionForTests(viewId)).toBe(true);

    const second = fakeWs({ ...data, reset: true });
    mapPtyWebsocket.open(second.ws);
    await Bun.sleep(250);
    expect(hasPtySessionForTests(viewId)).toBe(true);
    const out = Buffer.concat(second.sent.map((u) => Buffer.from(u))).toString();
    expect(out).toContain("snowshoe skill");
  });

  test("at capacity, oldest detached orphan is evicted", async () => {
    const ids: string[] = [];
    for (let i = 0; i < PTY_MAX_SESSIONS; i++) {
      const viewId = `cap-${i}-${crypto.randomUUID()}`;
      ids.push(viewId);
      const { ws } = fakeWs({
        viewId,
        mapUrl: "http://127.0.0.1:9",
        cwd: "/tmp",
        reset: false,
      });
      mapPtyWebsocket.open(ws);
      await Bun.sleep(80);
      mapPtyWebsocket.close(ws);
    }
    expect(ptySessionCountForTests()).toBe(PTY_MAX_SESSIONS);
    expect(hasPtySessionForTests(ids[0]!)).toBe(true);

    const extra = `cap-extra-${crypto.randomUUID()}`;
    const { ws } = fakeWs({
      viewId: extra,
      mapUrl: "http://127.0.0.1:9",
      cwd: "/tmp",
      reset: false,
    });
    mapPtyWebsocket.open(ws);
    await Bun.sleep(80);
    expect(ptySessionCountForTests()).toBe(PTY_MAX_SESSIONS);
    expect(hasPtySessionForTests(ids[0]!)).toBe(false);
    expect(hasPtySessionForTests(extra)).toBe(true);
  });
});
