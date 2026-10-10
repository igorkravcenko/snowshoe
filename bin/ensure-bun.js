#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBun, installerIsBun, missingBunMessage } from "./resolve-bun.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// bun add -g does not run this script (untrusted lifecycle). bun install in a
// clone does; skip the fetch so contributors / CI do not download a second Bun.
if (installerIsBun()) {
  process.exit(0);
}

const bunBin = await ensureBun({ packageRoot, installIfMissing: true });
if (!bunBin) {
  process.stderr.write(`${missingBunMessage()}\n`);
}
process.exit(0);
