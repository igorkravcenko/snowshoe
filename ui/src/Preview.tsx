import { Highlight, themes } from "prism-react-renderer";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { type Anchor, editorHref, type FilePreview, fetchFile } from "./api.ts";
import { prismLanguage } from "./preview-lang.ts";

function lineRange(
  start: number | undefined,
  end: number | undefined,
): { start?: number; end?: number } {
  if (start === undefined) return {};
  return { start, end: end ?? start };
}

function PlainCode(props: {
  text: string;
  start?: number;
  end?: number;
  hlRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  const lines = props.text.replace(/\n$/, "").split("\n");
  const { start, end } = lineRange(props.start, props.end);
  return (
    <pre className="preview-code preview-plain">
      {lines.map((line, i) => {
        const lineNo = i + 1;
        const hl = start !== undefined && end !== undefined && lineNo >= start && lineNo <= end;
        return (
          <div
            key={`L${lineNo}`}
            ref={hl && lineNo === start ? props.hlRef : undefined}
            className={hl ? "preview-line preview-hl" : "preview-line"}
          >
            <span className="preview-ln">{lineNo}</span>
            <span className="preview-src">{line.length === 0 ? " " : line}</span>
          </div>
        );
      })}
    </pre>
  );
}

export function PreviewPanel(props: {
  anchor: Anchor | null;
  repoRoot: string | null;
}): ReactElement | null {
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
    if (!data || !anchor?.startLine) return;
    const id = requestAnimationFrame(() => {
      hlRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [data, anchor?.startLine]);

  if (!anchor) {
    return (
      <section className="preview-panel" aria-label="Code preview">
        <h2>Code</h2>
        <p className="hint">Select an anchor in the inspector to preview here.</p>
      </section>
    );
  }

  const href = repoRoot ? editorHref(repoRoot, anchor) : undefined;
  const start = data?.startLine ?? anchor.startLine;
  const end = data?.endLine ?? anchor.endLine ?? start;
  const loc = [start ? `L${start}` : null, end && end !== start ? `L${end}` : null]
    .filter(Boolean)
    .join("–");
  const lang = data ? prismLanguage(data.path) : null;

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
      {data && lang ? (
        <Highlight theme={themes.nightOwl} code={data.text.replace(/\n$/, "")} language={lang}>
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
                    className={`${lineProps.className ?? ""} preview-line${hl ? " preview-hl" : ""}`}
                  >
                    <span className="preview-ln">{lineNo}</span>
                    {line.map((token) => {
                      const tokenProps = getTokenProps({ token });
                      return (
                        <span
                          key={`${lineNo}:${tokenProps.key ?? token.content}`}
                          {...tokenProps}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      ) : null}
      {data && !lang ? <PlainCode text={data.text} start={start} end={end} hlRef={hlRef} /> : null}
    </section>
  );
}
