import { readFileSync } from "node:fs";
import { join } from "node:path";
import { snowshoePackageRoot } from "./paths.ts";

/** Version string from this install's package.json (not a hardcoded constant). */
export function packageVersion(packageRoot = snowshoePackageRoot()): string {
  const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("package.json is missing a version string");
  }
  return parsed.version;
}
