#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function resolveSnowshoeEntry(): string {
  try {
    return require.resolve("@igorkravcenko/snowshoe");
  } catch {
    const local = join(import.meta.dir, "../../src/index.ts");
    if (existsSync(local)) return local;
    throw new Error(
      "snoe: cannot find @igorkravcenko/snowshoe. Install @igorkravcenko/snowshoe, or run from the Snowshoe git checkout.",
    );
  }
}

await import(resolveSnowshoeEntry());
