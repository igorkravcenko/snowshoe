import { defineCommand } from "citty";
import { runFeedbackAdd, runFeedbackList, runFeedbackRemove } from "./commands/feedback.ts";
import { runHelp } from "./commands/help.ts";
import { runInit } from "./commands/init.ts";
import {
  parseLeafFlag,
  parseMapStatusOpts,
  parseMetricUpdates,
  runMapDetailCancel,
  runMapDetailMark,
  runMapMark,
  runMapMetric,
  runMapSetLeaf,
  runMapStatus,
  runMapUnmark,
} from "./commands/map.ts";
import { runMapView } from "./commands/map-view.ts";
import { runRoutineAdvance, runRoutineRefresh, runRoutineStatus } from "./commands/routine.ts";
import { withSession } from "./commands/session.ts";
import { runSkillCat, runSkillInstall, runSkillList } from "./commands/skill.ts";
import {
  readStdinOrFlag,
  runWorkComplete,
  runWorkFail,
  runWorkNextFromCwd,
} from "./commands/work.ts";
import { DEFAULT_WORK_BATCH_SIZE } from "./domain/types.ts";
import { CliError, EXIT_USAGE } from "./errors.ts";
import { printJson } from "./json.ts";
import { parseMapExpandDepth, runMapServe } from "./map/serve.ts";

function emit(result: { exitCode: number; body: Record<string, unknown> }, _json: boolean): number {
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
  if (value === undefined || value === null || value === "") return DEFAULT_WORK_BATCH_SIZE;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new CliError("--batch-size must be a positive integer", EXIT_USAGE);
  }
  return n;
}

function parseWaitTimeout(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new CliError("--wait-timeout must be an integer >= 0 (ms; 0 = forever)", EXIT_USAGE);
  }
  return n;
}

const initCmd = defineCommand({
  meta: { name: "init", description: "Create .snowshoe/ ledger (no hooks)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    locale: {
      type: "string",
      description: "BCP-47 UI language (e.g. en, en-US). Idempotent amend of ledger meta.",
    },
    "ui-language": {
      type: "string",
      description: "Alias of --locale",
    },
    uiLanguage: {
      type: "string",
      description: "Camel alias of --locale",
    },
  },
  run({ args }) {
    return emit(
      runInit(process.cwd(), {
        locale: args.locale,
        uiLanguage: args["ui-language"] ?? args.uiLanguage,
      }),
      args.json,
    );
  },
});

const routineRefreshCmd = defineCommand({
  meta: { name: "refresh", description: "Open or supersede epoch from HEAD" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    target: { type: "string", description: "Explicit target SHA or ref" },
  },
  run({ args }) {
    return withSession((s) => emit(runRoutineRefresh(s, { target: args.target }), args.json));
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
      description: `Max items to claim (default ${DEFAULT_WORK_BATCH_SIZE})`,
    },
    batchSize: {
      type: "string",
      description: `Max items to claim (camel alias, default ${DEFAULT_WORK_BATCH_SIZE})`,
    },
    budget: {
      type: "string",
      description: "Deprecated alias of --batch-size",
    },
    wait: {
      type: "boolean",
      description: "Block while action would be idle (interactive map drain)",
      default: false,
    },
    "wait-timeout": {
      type: "string",
      description: "Max ms to wait when --wait (0 = forever)",
    },
    waitTimeout: {
      type: "string",
      description: "Camel alias of --wait-timeout",
    },
  },
  async run({ args }) {
    const batchSize = parseBatchSize(args["batch-size"] ?? args.batchSize ?? args.budget);
    const waitTimeoutMs = parseWaitTimeout(args["wait-timeout"] ?? args.waitTimeout);
    const wait = Boolean(args.wait) || waitTimeoutMs > 0;
    return emit(await runWorkNextFromCwd({ batchSize, wait, waitTimeoutMs }), args.json);
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
    fields: {
      type: "string",
      description: "Comma-separated node columns (default slug,children). Not with --all-fields",
    },
    "all-fields": {
      type: "boolean",
      description: "Every node column (UI). Not with --fields",
      default: false,
    },
    slug: {
      type: "string",
      description: "Focus slug (alone = that node; with --depth = subtree)",
    },
    depth: {
      type: "string",
      description: "Subtree depth from --slug, or from root if no slug. Not with --neighborhood",
    },
    neighborhood: {
      type: "boolean",
      description: "Ego graph around --slug (parents, children, refs, edges). Not with --depth",
      default: false,
    },
  },
  run({ args }) {
    return withSession((s) =>
      emit(
        runMapStatus(
          s,
          parseMapStatusOpts({
            fields: args.fields,
            slug: args.slug,
            depth: args.depth,
            neighborhood: args.neighborhood,
            allFields: args.allFields ?? args["all-fields"],
          }),
        ),
        args.json,
      ),
    );
  },
});

const mapMarkCmd = defineCommand({
  meta: {
    name: "mark",
    description: "Add a mark kind (each work kind queues its own hop step)",
  },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
    kind: {
      type: "string",
      description: "Mark kind: detail|expand|enrich|fix|learn|quiz|new|decayed",
      default: "expand",
    },
  },
  run({ args }) {
    return withSession((s) =>
      emit(runMapMark(s, String(args.slug), args.kind ?? "expand"), args.json),
    );
  },
});

const mapUnmarkCmd = defineCommand({
  meta: { name: "unmark", description: "Remove a mark kind" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
    kind: { type: "string", description: "Mark kind to remove", required: true },
  },
  run({ args }) {
    return withSession((s) => emit(runMapUnmark(s, String(args.slug), args.kind), args.json));
  },
});

const mapLeafCmd = defineCommand({
  meta: { name: "leaf", description: "Set the leaf stop-flag on a node" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
    leaf: { type: "string", description: "true or false", required: true },
  },
  run({ args }) {
    return withSession((s) =>
      emit(runMapSetLeaf(s, String(args.slug), parseLeafFlag(args.leaf)), args.json),
    );
  },
});

const mapMetricCmd = defineCommand({
  meta: {
    name: "metric",
    description:
      "Set comprehension metric floats on a node (overview/contracts/internals in [0,1]; not work next)",
  },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    slug: { type: "string", description: "Node slug", required: true },
    overview: { type: "string", description: "overview float in [0,1]" },
    contracts: { type: "string", description: "contracts float in [0,1]" },
    internals: { type: "string", description: "internals float in [0,1]" },
  },
  run({ args }) {
    return withSession((s) =>
      emit(
        runMapMetric(
          s,
          String(args.slug),
          parseMetricUpdates({
            overview: args.overview,
            contracts: args.contracts,
            internals: args.internals,
          }),
        ),
        args.json,
      ),
    );
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

const mapViewCmd = defineCommand({
  meta: {
    name: "view",
    description:
      "Re-read RAM map focus from a running map serve (SNOWSHOE_MAP_URL + SNOWSHOE_VIEW + SNOWSHOE_MAP_TOKEN)",
  },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    url: { type: "string", description: "Override SNOWSHOE_MAP_URL" },
    id: { type: "string", description: "Override SNOWSHOE_VIEW" },
  },
  async run({ args }) {
    return emit(await runMapView({ url: args.url, id: args.id }), args.json);
  },
});

const mapServeCmd = defineCommand({
  meta: {
    name: "serve",
    description: "Local map UI + HTTP twins of map status/mark/cancel (no SQLite from the UI)",
  },
  args: {
    port: { type: "string", description: "Port (default 3232; 0 = ephemeral)", default: "3232" },
    host: {
      type: "string",
      description: "Loopback bind only (default 127.0.0.1; localhost / ::1 also ok)",
      default: "127.0.0.1",
    },
    open: { type: "boolean", description: "Open the system browser", default: false },
    "expand-depth": {
      type: "string",
      description: "Tree levels expanded at start (0 = root collapsed; default 1 = root open)",
      default: "1",
    },
  },
  async run({ args }) {
    const port = Number(args.port);
    const { body, server } = await runMapServe({
      port: Number.isFinite(port) ? port : undefined,
      host: String(args.host),
      open: Boolean(args.open),
      expandDepth: parseMapExpandDepth(args["expand-depth"]),
    });
    printJson(body);
    await new Promise<void>((resolve) => {
      const stop = () => {
        server.stop();
        resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return 0;
  },
});

const mapCmd = defineCommand({
  meta: { name: "map", description: "Map read-model, detail ops, and local UI" },
  subCommands: {
    status: mapStatusCmd,
    mark: mapMarkCmd,
    unmark: mapUnmarkCmd,
    leaf: mapLeafCmd,
    metric: mapMetricCmd,
    detail: mapDetailCmd,
    view: mapViewCmd,
    serve: mapServeCmd,
  },
});

const feedbackAddCmd = defineCommand({
  meta: { name: "add", description: "Append a dev note about Snowshoe (optional)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    input: {
      type: "string",
      description: "JSON { text, command? } (else stdin)",
    },
  },
  async run({ args }) {
    const raw = await readStdinOrFlag(args.input);
    return emit(runFeedbackAdd(process.cwd(), raw), args.json);
  },
});

const feedbackRemoveCmd = defineCommand({
  meta: { name: "remove", description: "Delete one local feedback note by id" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    id: { type: "string", description: "Feedback entry id", required: true },
  },
  run({ args }) {
    return emit(runFeedbackRemove(process.cwd(), String(args.id)), args.json);
  },
});

const feedbackListCmd = defineCommand({
  meta: { name: "list", description: "List local Snowshoe feedback (newest first)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return emit(runFeedbackList(process.cwd()), args.json);
  },
});

const feedbackCmd = defineCommand({
  meta: { name: "feedback", description: "Optional local inbox for notes about Snowshoe" },
  subCommands: {
    add: feedbackAddCmd,
    remove: feedbackRemoveCmd,
    list: feedbackListCmd,
  },
});

const skillListCmd = defineCommand({
  meta: { name: "list", description: "List packaged product skill files" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return emit(runSkillList(process.cwd()), args.json);
  },
});

const skillCatCmd = defineCommand({
  meta: {
    name: "cat",
    description: "Print one packaged skill file (SKILL.md|drain.md|learn.md|install.md)",
  },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    file: {
      type: "positional",
      description: "Skill file name",
      required: true,
    },
  },
  run({ args }) {
    return emit(runSkillCat(String(args.file), process.cwd()), args.json);
  },
});

const skillInstallCmd = defineCommand({
  meta: {
    name: "install",
    description: "Copy packaged skill into <skills-path>/snowshoe/ (opt-in; not part of init)",
  },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
    "skills-path": {
      type: "string",
      description: "Harness skills directory (e.g. .cursor/skills)",
    },
    skillsPath: {
      type: "string",
      description: "Camel alias of --skills-path",
    },
    force: {
      type: "boolean",
      description: "Overwrite files that differ from the packaged skill",
      default: false,
    },
  },
  run({ args }) {
    return emit(
      runSkillInstall(
        {
          skillsPath: args["skills-path"] ?? args.skillsPath,
          force: Boolean(args.force),
        },
        process.cwd(),
      ),
      args.json,
    );
  },
});

const skillCmd = defineCommand({
  meta: {
    name: "skill",
    description: "Packaged product skill (list / cat / install into a harness skills dir)",
  },
  subCommands: {
    list: skillListCmd,
    cat: skillCatCmd,
    install: skillInstallCmd,
  },
});

const helpCmd = defineCommand({
  meta: { name: "help", description: "Agent command index (JSON)" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  run({ args }) {
    return emit(runHelp(process.cwd()), args.json);
  },
});

export const main = defineCommand({
  meta: {
    name: "snowshoe",
    description: "Don't let your agents outrun your understanding. Keep your footing.",
    version: "0.0.4",
  },
  subCommands: {
    help: helpCmd,
    init: initCmd,
    routine: routineCmd,
    work: workCmd,
    map: mapCmd,
    feedback: feedbackCmd,
    skill: skillCmd,
  },
});
