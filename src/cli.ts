import { defineCommand } from "citty";
import { CliError, EXIT_USAGE } from "./errors.ts";
import { printJson } from "./json.ts";
import { runInit } from "./commands/init.ts";
import { runMapDetailCancel, runMapDetailMark, runMapStatus } from "./commands/map.ts";
import {
  runRoutineAdvance,
  runRoutineRefresh,
  runRoutineStatus,
} from "./commands/routine.ts";
import { withSession } from "./commands/session.ts";
import { readStdinOrFlag, runWorkComplete, runWorkFail, runWorkNext } from "./commands/work.ts";

function emit(
  result: { exitCode: number; body: Record<string, unknown> },
  _json: boolean,
): number {
  printJson(result.body);
  process.exitCode = result.exitCode;
  return result.exitCode;
}

function batchSizeFromArgv(): string | undefined {
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--batch-size" || a === "--budget" || a === "--batchSize") {
      return argv[i + 1];
    }
    if (a.startsWith("--batch-size=")) return a.slice("--batch-size=".length);
  }
  return undefined;
}

function parseBatchSize(raw: unknown): number {
  const value = raw === undefined || raw === null || raw === "" ? batchSizeFromArgv() : raw;
  if (value === undefined || value === null || value === "") return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new CliError("--batch-size must be a positive integer", EXIT_USAGE);
  }
  return n;
}

const initCmd = defineCommand({
  meta: { name: "init", description: "Create .snowshoe/ ledger (no hooks)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return emit(runInit(), args.json);
  },
});

const routineRefreshCmd = defineCommand({
  meta: { name: "refresh", description: "Open or supersede epoch from HEAD" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    target: { type: "string", description: "Explicit target SHA or ref" },
  },
  run({ args }) {
    return withSession((s) =>
      emit(runRoutineRefresh(s, { target: args.target }), args.json),
    );
  },
});

const routineStatusCmd = defineCommand({
  meta: { name: "status", description: "Epoch progress without claiming work" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return withSession((s) => emit(runRoutineStatus(s), args.json));
  },
});

const routineAdvanceCmd = defineCommand({
  meta: { name: "advance", description: "Set base := target iff FSM allows" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return withSession((s) => emit(runRoutineAdvance(s), args.json));
  },
});

const routineCmd = defineCommand({
  meta: { name: "routine", description: "Epoch catch-up commands" },
  subCommands: {
    refresh: routineRefreshCmd,
    status: routineStatusCmd,
    advance: routineAdvanceCmd,
  },
});

const workNextCmd = defineCommand({
  meta: { name: "next", description: "Claim a batch of work items (routine first)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    "batch-size": {
      type: "string",
      description: "Max items to claim",
    },
    batchSize: {
      type: "string",
      description: "Max items to claim (camel alias)",
    },
    budget: {
      type: "string",
      description: "Deprecated alias of --batch-size",
    },
  },
  run({ args }) {
    const batchSize = parseBatchSize(
      args["batch-size"] ?? args.batchSize ?? args.budget,
    );
    return withSession((s) => emit(runWorkNext(s, { batchSize }), args.json));
  },
});

const workCompleteCmd = defineCommand({
  meta: { name: "complete", description: "Submit completions for accept/reject" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    input: {
      type: "string",
      description: "JSON envelope (else stdin)",
    },
  },
  async run({ args }) {
    const raw = await readStdinOrFlag(args.input);
    return withSession((s) => emit(runWorkComplete(s, raw), args.json));
  },
});

const workFailCmd = defineCommand({
  meta: { name: "fail", description: "Fail a routine step (not detail)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    input: {
      type: "string",
      description: "JSON envelope (else stdin)",
    },
  },
  async run({ args }) {
    const raw = await readStdinOrFlag(args.input);
    return withSession((s) => emit(runWorkFail(s, raw), args.json));
  },
});

const workCmd = defineCommand({
  meta: { name: "work", description: "Work bus (claim / complete / fail)" },
  subCommands: {
    next: workNextCmd,
    complete: workCompleteCmd,
    fail: workFailCmd,
  },
});

const mapStatusCmd = defineCommand({
  meta: { name: "status", description: "Map read-model JSON" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return withSession((s) => emit(runMapStatus(s), args.json));
  },
});

const mapDetailMarkCmd = defineCommand({
  meta: { name: "mark", description: "Enqueue kind=detail for a slug" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
  },
  run({ args }) {
    return withSession((s) => emit(runMapDetailMark(s, String(args.slug)), args.json));
  },
});

const mapDetailCancelCmd = defineCommand({
  meta: { name: "cancel", description: "Cancel pending detail for a slug" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
  },
  run({ args }) {
    return withSession((s) => emit(runMapDetailCancel(s, String(args.slug)), args.json));
  },
});

const mapDetailCmd = defineCommand({
  meta: { name: "detail", description: "User detail queue ops" },
  subCommands: {
    mark: mapDetailMarkCmd,
    cancel: mapDetailCancelCmd,
  },
});

const mapCmd = defineCommand({
  meta: { name: "map", description: "Map read-model and detail ops" },
  subCommands: {
    status: mapStatusCmd,
    detail: mapDetailCmd,
  },
});

export const main = defineCommand({
  meta: {
    name: "snowshoe",
    description: "Catch up after pull — personal repo comprehension map",
    version: "0.0.1",
  },
  subCommands: {
    init: initCmd,
    routine: routineCmd,
    work: workCmd,
    map: mapCmd,
  },
});
