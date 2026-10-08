import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeGitRepo, snowshoe } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");
const SNOE_PKG = join(ROOT, "packages/snoe/package.json");
const SNOE_CLI = join(ROOT, "packages/snoe/cli.ts");
const ROOT_PKG = join(ROOT, "package.json");

describe("snoe npm alias package", () => {
  test("is a thin wrapper of the scoped CLI at the same version", () => {
    const root = JSON.parse(readFileSync(ROOT_PKG, "utf8")) as {
      name: string;
      version: string;
      private?: boolean;
      bin: Record<string, string>;
      publishConfig?: { access?: string };
    };
    const snoe = JSON.parse(readFileSync(SNOE_PKG, "utf8")) as {
      name: string;
      version: string;
      license: string;
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };

    expect(root.name).toBe("@igorkravcenko/snowshoe");
    expect(root.private).toBeUndefined();
    expect(root.publishConfig?.access).toBe("public");
    expect(root.bin.snowshoe).toBe("./src/index.ts");
    expect(root.bin.snoe).toBe("./src/index.ts");

    expect(snoe.name).toBe("@igorkravcenko/snoe");
    expect(snoe.version).toBe(root.version);
    expect(snoe.license).toBe("Apache-2.0");
    expect(snoe.bin).toEqual({ snoe: "./cli.ts" });
    expect(snoe.dependencies["@igorkravcenko/snowshoe"]).toBe(root.version);
    expect(snoe.bin.snowshoe).toBeUndefined();
  });

  test("snoe bin re-exports the same CLI as snowshoe", async () => {
    const repo = makeGitRepo();
    const viaSnowshoe = await snowshoe(repo, ["help", "--json"]);
    const viaSnoe = Bun.spawnSync(["bun", SNOE_CLI, "help", "--json"], {
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(viaSnowshoe.exitCode).toBe(0);
    expect(viaSnoe.exitCode).toBe(0);
    expect(viaSnoe.stdout.toString()).toBe(viaSnowshoe.stdout);
  });
});
