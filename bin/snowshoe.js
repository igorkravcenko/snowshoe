#!/usr/bin/env node
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureBun,
  missingBunMessage,
  nodeEngineMessage,
  nodeEngineOk,
  spawnBun,
} from "./resolve-bun.js";

if (!nodeEngineOk()) {
  process.stderr.write(`${nodeEngineMessage()}\n`);
  process.exit(1);
}

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(packageRoot, "src", "index.ts");

const bunBin = await ensureBun({ packageRoot, installIfMissing: true });
if (!bunBin) {
  process.stderr.write(`${missingBunMessage()}\n`);
  process.exit(1);
}

const child = spawnBun(bunBin, [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
/** @type {Map<string, () => void>} */
const handlers = new Map();
/** @type {NodeJS.Signals | null} */
let receivedSignal = null;

function detachSignals() {
  for (const [signal, handler] of handlers) {
    process.removeListener(signal, handler);
  }
  handlers.clear();
}

function exitForSignal(signal) {
  const n = osConstants.signals[signal];
  process.exit(typeof n === "number" ? 128 + n : 1);
}

for (const signal of SIGNALS) {
  const handler = () => {
    receivedSignal = signal;
    detachSignals();
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // Child already gone.
      }
    }
  };
  handlers.set(signal, handler);
  process.on(signal, handler);
}

child.on("error", (err) => {
  detachSignals();
  process.stderr.write(`Snowshoe failed to start Bun (${bunBin}): ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  detachSignals();
  const sig = signal || receivedSignal;
  if (sig) {
    exitForSignal(sig);
  }
  process.exit(code ?? 1);
});
