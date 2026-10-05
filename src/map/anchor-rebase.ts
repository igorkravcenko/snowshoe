/** Rebase stored window using identity lineText. Closest locator match wins. */
export function rebaseAnchor(opts: {
  fileText: string;
  storedStart?: number;
  locatorOffset?: number | null;
  lineText?: string | null;
  span?: number | null;
}): { startLine?: number; endLine?: number } {
  const offset =
    opts.locatorOffset !== undefined && opts.locatorOffset !== null && opts.locatorOffset >= 0
      ? opts.locatorOffset
      : 0;
  const stored = opts.storedStart;
  const storedLocator = stored !== undefined ? stored + offset : undefined;
  const needle = opts.lineText?.trim() ?? "";
  let locator = storedLocator;
  if (needle) {
    const lines = opts.fileText.replace(/\n$/, "").split(/\r?\n/);
    const hits: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim() === needle) hits.push(i + 1);
    }
    if (hits.length) {
      const target = storedLocator ?? hits[0]!;
      locator = hits.reduce((best, n) =>
        Math.abs(n - target) < Math.abs(best - target) ? n : best,
      );
    }
  }
  let start: number | undefined;
  if (locator !== undefined) {
    start = Math.max(1, locator - offset);
  } else if (stored !== undefined) {
    start = stored;
  }
  const span = opts.span;
  let end: number | undefined;
  if (start !== undefined && span !== undefined && span !== null && span >= 1) {
    end = start + span - 1;
  }
  return {
    ...(start !== undefined ? { startLine: start } : {}),
    ...(end !== undefined ? { endLine: end } : {}),
  };
}
