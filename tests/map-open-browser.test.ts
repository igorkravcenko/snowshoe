import { afterEach, describe, expect, test } from "bun:test";
import {
  BROWSER_OPEN_FAILED_HINT,
  BROWSER_OPEN_TIMEOUT_MS,
  browserOpenArgv,
  tryOpenBrowser,
} from "../src/map/open-browser.ts";
import { MAP_SERVE_HINT, runMapServe } from "../src/map/serve.ts";
import { makeGitRepo, mapApi } from "./helpers.ts";

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("tryOpenBrowser", () => {
  test("browserOpenArgv matches the host platform", () => {
    expect(browserOpenArgv("http://127.0.0.1:3232/#t=x", "linux")).toEqual([
      "xdg-open",
      "http://127.0.0.1:3232/#t=x",
    ]);
    expect(browserOpenArgv("http://127.0.0.1:3232/#t=x", "darwin")).toEqual([
      "open",
      "http://127.0.0.1:3232/#t=x",
    ]);
    expect(browserOpenArgv("http://127.0.0.1:3232/#t=x", "win32")).toEqual([
      "cmd",
      "/c",
      "start",
      "",
      "http://127.0.0.1:3232/#t=x",
    ]);
  });

  test("success when the opener exits 0", () => {
    expect(tryOpenBrowser("http://127.0.0.1:3232/#t=x", { argv: ["true"] })).toEqual({
      opened: true,
    });
  });

  test("records exit code and stderr when the opener fails", () => {
    const r = tryOpenBrowser("http://127.0.0.1:3232/#t=x", {
      argv: ["sh", "-c", "echo 'xdg-open: no method available' >&2; exit 3"],
    });
    expect(r.opened).toBe(false);
    if (r.opened) throw new Error("expected failure");
    expect(r.error).toContain("sh exited 3");
    expect(r.error).toContain("no method available");
  });

  test("missing opener is a failure, not a throw", () => {
    const r = tryOpenBrowser("http://127.0.0.1:3232/#t=x", {
      argv: ["/no-such-snowshoe-browser"],
    });
    expect(r.opened).toBe(false);
    if (r.opened) throw new Error("expected failure");
    expect(r.error).toMatch(/no-such-snowshoe-browser/i);
  });

  test("timeout is reported as failure", () => {
    const r = tryOpenBrowser("http://127.0.0.1:3232/#t=x", {
      argv: ["xdg-open", "http://127.0.0.1:3232/#t=x"],
      spawnSync: () => ({
        exitCode: null,
        success: false,
        stdout: { toString: () => "" },
        stderr: { toString: () => "" },
        exitedDueToTimeout: true,
      }),
    });
    expect(r).toEqual({
      opened: false,
      error: `xdg-open timed out after ${BROWSER_OPEN_TIMEOUT_MS}ms`,
    });
  });
});

describe("map serve --open JSON", () => {
  test("failed open still prints url and a note; server stays up", async () => {
    const repo = makeGitRepo();
    const { body, server } = await runMapServe({
      cwd: repo,
      port: 0,
      open: true,
      buildUi: false,
      openBrowser: () => ({
        opened: false,
        error: "xdg-open exited 3: no method available for opening 'http://127.0.0.1/'",
      }),
    });
    stop = server.stop;
    expect(body.ok).toBe(true);
    expect(String(body.url)).toContain("#t=");
    expect(body.browserOpened).toBe(false);
    expect(String(body.browserOpenError)).toContain("xdg-open exited 3");
    expect(String(body.hint)).toBe(`${BROWSER_OPEN_FAILED_HINT} ${MAP_SERVE_HINT}`);
    const sess = await mapApi(server, "api/session");
    expect(sess.ok).toBe(true);
  });

  test("successful open records browserOpened without an error field", async () => {
    const repo = makeGitRepo();
    const { body, server } = await runMapServe({
      cwd: repo,
      port: 0,
      open: true,
      buildUi: false,
      openBrowser: () => ({ opened: true }),
    });
    stop = server.stop;
    expect(body.browserOpened).toBe(true);
    expect(body.browserOpenError).toBeUndefined();
    expect(String(body.hint)).toBe(MAP_SERVE_HINT);
  });

  test("without --open, browser fields are omitted", async () => {
    const repo = makeGitRepo();
    const { body, server } = await runMapServe({
      cwd: repo,
      port: 0,
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    expect(body.browserOpened).toBeUndefined();
    expect(body.browserOpenError).toBeUndefined();
    expect(String(body.hint)).toBe(MAP_SERVE_HINT);
  });
});
