#!/usr/bin/env bun
import { runCommand } from "citty";
import { main } from "./cli.ts";
import { handleHelpArgs, wantsHelp } from "./cli-help.ts";
import { CliError, EXIT_INTERNAL, EXIT_USAGE } from "./errors.ts";
import { printJson } from "./json.ts";

async function mainAsync(): Promise<number> {
  const rawArgs = process.argv.slice(2);
  try {
    if (wantsHelp(rawArgs)) {
      return await handleHelpArgs(main, rawArgs);
    }
    const { result } = await runCommand(main, { rawArgs });
    if (typeof result === "number") return result;
    const code = process.exitCode;
    return typeof code === "number" ? code : 0;
  } catch (err) {
    if (err instanceof CliError) {
      printJson({
        schemaVersion: 1,
        ok: false,
        error: err.message,
        ...err.body,
      });
      return err.exitCode;
    }
    const message = err instanceof Error ? err.message : String(err);
    const usage = /unknown|missing required|invalid|usage/i.test(message);
    printJson({
      schemaVersion: 1,
      ok: false,
      error: message,
    });
    return usage ? EXIT_USAGE : EXIT_INTERNAL;
  }
}

const code = await mainAsync();
process.exit(code);
