import type { ArgsDef, CommandDef } from "citty";
import { renderUsage } from "citty";
import { runHelp } from "./commands/help.ts";
import { printJson } from "./json.ts";
import { packageVersion } from "./package-version.ts";

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
  if (rawArgs.includes("--version") || rawArgs.includes("-V")) return true;
  const tokens = rawArgs.filter((a) => !a.startsWith("-"));
  return tokens[0] === "version";
}

export function handleVersionArgs(): number {
  process.stdout.write(`${packageVersion()}\n`);
  return 0;
}

export function hasCommandToken(rawArgs: string[]): boolean {
  return rawArgs.some((a) => !a.startsWith("-"));
}

/**
 * `--help` / `-h` never executes a command.
 * Root → same JSON index as `snowshoe help`. Subcommand → citty usage only.
 * Uses stdout.write (not consola) so tests and pipes see usage.
 */
export async function handleHelpArgs(mainCmd: AnyCommand, rawArgs: string[]): Promise<number> {
  if (!hasCommandToken(rawArgs)) {
    const { body, exitCode } = runHelp();
    printJson(body);
    return exitCode;
  }
  const [cmd, parent] = await resolveSubCommand(mainCmd, rawArgs);
  const text = await renderUsage(cmd, parent);
  process.stdout.write(`${text}\n`);
  return 0;
}
