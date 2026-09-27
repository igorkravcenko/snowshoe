import type { Language } from "prism-react-renderer";

/** Grammars that Prism renders cleanly. Markdown/YAML grammars garble docs. */
const EXT_LANG: Record<string, Language> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  html: "markup",
  htm: "markup",
  sh: "bash",
  bash: "bash",
  py: "python",
  rs: "rust",
  go: "go",
};

export function prismLanguage(path: string): Language | null {
  const base = path.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  return EXT_LANG[ext] ?? null;
}
