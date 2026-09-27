export class CliError extends Error {
  readonly exitCode: number;
  readonly body: Record<string, unknown>;

  constructor(message: string, exitCode: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.body = body;
  }
}

export const EXIT_OK = 0;
export const EXIT_ATTENTION = 1;
export const EXIT_USAGE = 2;
export const EXIT_INTERNAL = 3;
