#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBun, missingBunMessage } from "./resolve-bun.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(packageRoot, "src", "index.ts");

const bunBin = await ensureBun({ packageRoot, installIfMissing: true });
if (!bunBin) {
  process.stderr.write(`${missingBunMessage()}\n`);
  process.exit(1);
}

const child = spawn(bunBin, [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

const forward = (signal) => {
  if (!child.killed) {
    try {
      child.kill(signal);
    } catch {
      // Child already gone.
    }
  }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => forward(signal));
}

child.on("error", (err) => {
  process.stderr.write(`Snowshoe failed to start Bun (${bunBin}): ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    try {
      process.kill(process.pid, signal);
    } catch {
      process.exit(1);
    }
    return;
  }
  process.exit(code ?? 1);
});
