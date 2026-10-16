/** How long `map serve --open` waits for `xdg-open` / `open` / `start`. */
export const BROWSER_OPEN_TIMEOUT_MS = 5_000;

export const BROWSER_OPEN_FAILED_HINT = "Could not open a browser; open url manually.";

export type BrowserOpenResult = { opened: true } | { opened: false; error: string };

type SpawnSyncResult = {
  exitCode: number | null;
  signalCode?: string | null;
  stdout: { toString(): string };
  stderr: { toString(): string };
  success: boolean;
  exitedDueToTimeout?: boolean;
};

type SpawnSyncFn = (
  argv: string[],
  opts: { stdout: "pipe"; stderr: "pipe"; stdin: "ignore"; timeout: number },
) => SpawnSyncResult;

export function browserOpenArgv(url: string, platform = process.platform): string[] {
  if (platform === "darwin") return ["open", url];
  if (platform === "win32") return ["cmd", "/c", "start", "", url];
  return ["xdg-open", url];
}

function formatOpenError(cmd: string, proc: SpawnSyncResult): string {
  if (proc.exitedDueToTimeout) return `${cmd} timed out after ${BROWSER_OPEN_TIMEOUT_MS}ms`;
  const detail = (proc.stderr.toString() || proc.stdout.toString()).trim().replace(/\s+/g, " ");
  const code = proc.exitCode ?? proc.signalCode ?? "unknown";
  return detail ? `${cmd} exited ${code}: ${detail}` : `${cmd} exited ${code}`;
}

/** Best-effort system browser. Failure does not stop `map serve`. */
export function tryOpenBrowser(
  url: string,
  opts: { argv?: string[]; spawnSync?: SpawnSyncFn } = {},
): BrowserOpenResult {
  const argv = opts.argv ?? browserOpenArgv(url);
  const cmd = argv[0] ?? "xdg-open";
  const spawn = opts.spawnSync ?? ((a, o) => Bun.spawnSync(a, o));
  try {
    const proc = spawn(argv, {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      timeout: BROWSER_OPEN_TIMEOUT_MS,
    });
    if (proc.success) return { opened: true };
    return { opened: false, error: formatOpenError(cmd, proc) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { opened: false, error: `${cmd}: ${message}` };
  }
}
