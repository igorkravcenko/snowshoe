import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { makeGitRepo, snowshoe } from "./helpers.ts";

describe("CLI --help / -h never executes", () => {
  test("root --help and -h match help index, exit 0", async () => {
    const repo = makeGitRepo();
    const viaFlag = await snowshoe(repo, ["--help"]);
    expect(viaFlag.exitCode).toBe(0);
    expect(viaFlag.json.command).toBe("help");
    expect(viaFlag.json.audience).toBe("agent");
    expect(Array.isArray(viaFlag.json.commands)).toBe(true);

    const viaShort = await snowshoe(repo, ["-h"]);
    expect(viaShort.exitCode).toBe(0);
    expect(viaShort.json.command).toBe("help");

    const viaHelp = await snowshoe(repo, ["help"]);
    expect(viaHelp.exitCode).toBe(0);
    expect(viaHelp.json.commands).toEqual(viaFlag.json.commands);
  });

  test("init --help does not create .snowshoe", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["init", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(repo, ".snowshoe"))).toBe(false);
    expect(r.stdout + r.stderr).toMatch(/USAGE|init/i);
    expect(r.json.command).not.toBe("init");
  });

  test("map serve --help does not bind a port", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const r = await snowshoe(repo, ["map", "serve", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).not.toBe("map.serve");
    expect(r.stdout + r.stderr).toMatch(/USAGE|serve/i);
    // JSON body from a real serve includes url/port; help should not.
    expect(r.json.url).toBeUndefined();
    expect(r.json.port).toBeUndefined();
  });
});
