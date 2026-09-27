import { Highlight, themes } from "prism-react-renderer";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { type Anchor, editorHref, type FilePreview, fetchFile } from "./api.ts";

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  html: "markup",
  htm: "markup",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  bash: "bash",
  py: "python",
  rs: "rust",
  go: "go",
};

export function languageFor(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  return EXT_LANG[ext] ?? "clike";
}

export function PreviewPanel(props: {
  anchor: Anchor | null;
  repoRoot: string | null;
}): ReactElement {
  const { anchor, repoRoot } = props;
  const [data, setData] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchFile(anchor.path, anchor.startLine, anchor.endLine)
      .then((body) => {
        if (!cancelled) {
          setData(body);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [anchor]);

  useEffect(() => {
    if (!data) return;
    hlRef.current?.scrollIntoView({ block: "center" });
  }, [data]);

  if (!anchor) {
    return (
      <section className="preview-panel" aria-label="Code preview">
        <h2>Code preview</h2>
        <p className="hint">
          Click an anchor on any node to preview the file here. Open in editor is secondary. The
          util never launches an editor.
        </p>
      </section>
    );
  }

  const href = repoRoot ? editorHref(repoRoot, anchor) : undefined;
  const start = data?.startLine ?? anchor.startLine;
  const end = data?.endLine ?? anchor.endLine ?? start;
  const loc = [start ? `L${start}` : null, end && end !== start ? `L${end}` : null]
    .filter(Boolean)
    .join("–");

  return (
    <section className="preview-panel" aria-label="Code preview">
      <div className="preview-toolbar">
        <div>
          <h2>Code preview</h2>
          <p className="mono">
            {anchor.path}
            {loc ? ` · ${loc}` : ""}
            {anchor.symbol ? ` · ${anchor.symbol}` : ""}
          </p>
        </div>
        {href ? (
          <a
            className="secondary-action"
            href={href}
            title="Open in editor (UI owns this; util does not)"
          >
            Open in editor
          </a>
        ) : (
          <span className="hint">Open in editor needs session repoRoot</span>
        )}
      </div>
      {loading ? <p className="hint">Loading preview…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {data ? (
        <Highlight theme={themes.nightOwl} code={data.text} language={languageFor(data.path)}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={`preview-code ${className}`} style={style}>
              {tokens.map((line, i) => {
                const lineNo = i + 1;
                const hl =
                  start !== undefined && end !== undefined && lineNo >= start && lineNo <= end;
                const lineProps = getLineProps({ line });
                return (
                  <div
                    {...lineProps}
                    key={`L${lineNo}`}
                    ref={hl && lineNo === start ? hlRef : undefined}
                    className={`${lineProps.className ?? ""}${hl ? " preview-hl" : ""}`}
                  >
                    <span className="preview-ln">{lineNo}</span>
                    {line.map((token) => (
                      <span
                        key={`${lineNo}:${token.types.join("/")}:${token.content}`}
                        {...getTokenProps({ token })}
                      />
                    ))}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      ) : null}
    </section>
  );
}
