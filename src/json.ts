import { SCHEMA_VERSION } from "./domain/types.ts";

export type Envelope = {
  schemaVersion: number;
  command: string;
  ok: boolean;
  repoRoot: string;
  gitHead: string | null;
} & Record<string, unknown>;

export function envelope(
  command: string,
  repoRoot: string,
  gitHead: string | null,
  extra: Record<string, unknown> = {},
): Envelope {
  const { ok: extraOk, ...rest } = extra;
  return {
    schemaVersion: SCHEMA_VERSION,
    command,
    ok: extraOk === undefined ? true : Boolean(extraOk),
    repoRoot,
    gitHead,
    ...rest,
  };
}

export function printJson(body: unknown): void {
  process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
}
