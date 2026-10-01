/** Rebase stored startLine using exact trimmed line text. Closest match wins. */
export function rebaseAnchor(opts: {
  fileText: string;
  storedStart?: number;
  lineText?: string | null;
  span?: number | null;
}): { startLine?: number; endLine?: number } {
  const stored = opts.storedStart;
  const needle = opts.lineText?.trim() ?? "";
  let start = stored;
  if (needle) {
    const lines = opts.fileText.replace(/\n$/, "").split(/\r?\n/);
    const hits: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim() === needle) hits.push(i + 1);
    }
    if (hits.length) {
      const target = stored ?? hits[0]!;
      start = hits.reduce((best, n) => (Math.abs(n - target) < Math.abs(best - target) ? n : best));
    }
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
