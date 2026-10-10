import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeGitRepo, snowshoe } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };

describe("snowshoe --version", () => {
  test("--version and version print package.json version and exit 0", async () => {
    const repo = makeGitRepo();
    const viaFlag = await snowshoe(repo, ["--version"]);
    expect(viaFlag.exitCode).toBe(0);
    expect(viaFlag.stdout.trim()).toBe(pkg.version);
    expect(viaFlag.stderr).toBe("");

    const viaV = await snowshoe(repo, ["-V"]);
    expect(viaV.exitCode).toBe(0);
    expect(viaV.stdout.trim()).toBe(pkg.version);

    const viaCmd = await snowshoe(repo, ["version"]);
    expect(viaCmd.exitCode).toBe(0);
    expect(viaCmd.stdout.trim()).toBe(pkg.version);
  });

  test("help --json is unchanged and is not the version string", async () => {
    const repo = makeGitRepo();
    const help = await snowshoe(repo, ["help", "--json"]);
    expect(help.exitCode).toBe(0);
    expect(help.json.command).toBe("help");
    expect(help.json.audience).toBe("agent");
    expect(Array.isArray(help.json.commands)).toBe(true);
    expect(help.stdout.trim()).not.toBe(pkg.version);

    const rootHelp = await snowshoe(repo, ["--help"]);
    expect(rootHelp.exitCode).toBe(0);
    expect(rootHelp.json.command).toBe("help");
  });
});
