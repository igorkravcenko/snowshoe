import type { ArgsDef, CommandDef } from "citty";
import { renderUsage } from "citty";
import { runHelp } from "./commands/help.ts";
import { formatWorkCompleteHelpText, runWorkCompleteHelp } from "./commands/work-complete-help.ts";
import { EXIT_OK } from "./errors.ts";
import { printJson } from "./json.ts";
import { packageVersion } from "./package-version.ts";

/** Short human postcard for `snowshoe` / `--help` / `-h` (not the agent index). */
export const ROOT_USAGE = `Snowshoe — don't let your agents outrun your understanding. Keep your footing.

  snowshoe map serve --open
  snowshoe skill install --json --skills-path .cursor/skills
  snowshoe work next --json
  snowshoe --version

Agents: snowshoe help --json
More:   snowshoe <command> --help
`;

export function printRootUsage(): number {
  process.stdout.write(ROOT_USAGE);
  return EXIT_OK;
}

export function printAgentHelp(cwd = process.cwd()): number {
  const { body, exitCode } = runHelp(cwd);
  printJson(body);
  return exitCode;
}

type AnyCommand = CommandDef<ArgsDef>;

async function resolveValue<T>(val: T | (() => T | Promise<T>)): Promise<T> {
  return typeof val === "function" ? await (val as () => T | Promise<T>)() : val;
}

/** Walk citty subCommands the same way runMain/resolveSubCommand does. */
export async function resolveSubCommand(
  cmd: AnyCommand,
  rawArgs: string[],
  parent?: AnyCommand,
): Promise<[AnyCommand, AnyCommand | undefined]> {
  const subCommands = await resolveValue(cmd.subCommands as Record<string, AnyCommand> | undefined);
  if (subCommands && Object.keys(subCommands).length > 0) {
    const subCommandArgIndex = rawArgs.findIndex((arg) => !arg.startsWith("-"));
    const subCommandName = rawArgs[subCommandArgIndex];
    if (subCommandName) {
      const subCommand = await resolveValue(subCommands[subCommandName]);
      if (subCommand) {
        return resolveSubCommand(subCommand, rawArgs.slice(subCommandArgIndex + 1), cmd);
      }
    }
  }
  return [cmd, parent];
}

export function wantsHelp(rawArgs: string[]): boolean {
  return rawArgs.includes("--help") || rawArgs.includes("-h");
}

export function wantsVersion(rawArgs: string[]): boolean {
  return rawArgs.includes("--version") || rawArgs.includes("-V");
}

export function handleVersionArgs(): number {
  process.stdout.write(`${packageVersion()}\n`);
  return 0;
}

export function hasCommandToken(rawArgs: string[]): boolean {
  return rawArgs.some((a) => !a.startsWith("-"));
}

export function isWorkCompleteHelp(rawArgs: string[]): boolean {
  const tokens = rawArgs.filter((a) => !a.startsWith("-"));
  return tokens[0] === "work" && tokens[1] === "complete";
}

/**
 * `--help` / `-h` never executes a command.
 * Root → human postcard unless `--json` (then the agent index).
 * `work complete` → payload contract (JSON when `--json`); other subcommands → citty usage.
 * Uses stdout.write (not consola) so tests and pipes see usage.
 */
export async function handleHelpArgs(
  mainCmd: AnyCommand,
  rawArgs: string[],
  cwd = process.cwd(),
): Promise<number> {
  if (!hasCommandToken(rawArgs)) {
    if (rawArgs.includes("--json")) return printAgentHelp(cwd);
    return printRootUsage();
  }
  if (isWorkCompleteHelp(rawArgs)) {
    if (rawArgs.includes("--json")) {
      const { body, exitCode } = runWorkCompleteHelp(cwd);
      printJson(body);
      return exitCode;
    }
    const [cmd, parent] = await resolveSubCommand(mainCmd, rawArgs);
    const usage = await renderUsage(cmd, parent);
    process.stdout.write(`${usage}\n${formatWorkCompleteHelpText()}`);
    return 0;
  }
  const [cmd, parent] = await resolveSubCommand(mainCmd, rawArgs);
  const text = await renderUsage(cmd, parent);
  process.stdout.write(`${text}\n`);
  return 0;
}
