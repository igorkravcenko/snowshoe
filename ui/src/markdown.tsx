import { createElement, type ReactElement, type ReactNode } from "react";
import { parseWikiLink, resolveWikiLink } from "./wiki.ts";

export type WikiResolve = {
  /** Display title when the slug exists; omit/undefined when missing. */
  titleForSlug?: (slug: string) => string | undefined;
  onGoTo?: (slug: string) => void;
};

function safeHref(raw: string): string | null {
  const t = raw.trim();
  if (/^(https?:\/\/|\/|#)/i.test(t) && !/^(javascript|data|vbscript):/i.test(t)) {
    return t;
  }
  return null;
}

function wikiNode(slug: string, label: string, key: string, wiki?: WikiResolve): ReactNode {
  const resolved = resolveWikiLink(slug, label, wiki?.titleForSlug);
  if (resolved.missing) {
    return (
      <span key={key} className="wiki-missing" title={`Missing node: ${slug}`}>
        {resolved.text}
      </span>
    );
  }
  if (!wiki?.onGoTo) {
    return (
      <span key={key} className="wiki-link">
        {resolved.text}
      </span>
    );
  }
  return (
    <button
      key={key}
      type="button"
      className="wiki-link linkish"
      title={`Go to ${slug}`}
      onClick={() => wiki.onGoTo?.(slug)}
    >
      {resolved.text}
    </button>
  );
}

function inline(text: string, keyPrefix: string, wiki?: WikiResolve): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let i = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      nodes.push(<code key={`${keyPrefix}-c-${i}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[[") && m[2] !== undefined) {
      const parsed = parseWikiLink(m[2]);
      if (parsed) {
        nodes.push(wikiNode(parsed.slug, parsed.label, `${keyPrefix}-w-${i}`, wiki));
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("*") && !token.startsWith("**") && !token.startsWith("[[")) {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    } else if (m[3] !== undefined) {
      const href = safeHref(m[4] ?? "");
      if (href) {
        nodes.push(
          <a key={`${keyPrefix}-a-${i}`} href={href} rel="noreferrer">
            {m[3]}
          </a>,
        );
      } else {
        nodes.push(m[3]);
      }
    } else {
      nodes.push(token);
    }
    last = m.index + token.length;
    i++;
    m = re.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Split a GFM table row into cell texts (pipes optional at ends). */
export function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

/** True when the line is a GFM table separator (`| --- | :---: |`). */
export function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c));
}

function looksLikeTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  return splitTableRow(t).length >= 1;
}

type CellAlign = "left" | "right" | "center" | undefined;

function alignFromSep(cell: string): CellAlign {
  const t = cell.trim();
  const left = t.startsWith(":");
  const right = t.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return undefined;
}

function isBlockBoundary(line: string): boolean {
  return (
    line.trim() === "" || line.startsWith("```") || /^#{1,3}\s+/.test(line) || /^[-*]\s+/.test(line)
  );
}

/** Dumb, HTML-escaping markdown subset for inspector bodies (no editor). */
export function MarkdownBody(props: {
  text: string;
  titleForSlug?: (slug: string) => string | undefined;
  onGoTo?: (slug: string) => void;
}): ReactElement {
  const wiki: WikiResolve | undefined =
    props.titleForSlug || props.onGoTo
      ? { titleForSlug: props.titleForSlug, onGoTo: props.onGoTo }
      : undefined;
  const blocks: ReactElement[] = [];
  const lines = props.text.replaceAll("\r\n", "\n").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        buf.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre key={`pre-${k++}`}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const tag = heading[1]!.length === 3 ? "h4" : "h3";
      blocks.push(createElement(tag, { key: `h-${k++}` }, inline(heading[2]!, `h${k}`, wiki)));
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: ReactElement[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(
          <li key={`li-${k}-${i}`}>{inline(lines[i]!.replace(/^[-*]\s+/, ""), `li${i}`, wiki)}</li>,
        );
        i++;
      }
      blocks.push(<ul key={`ul-${k++}`}>{items}</ul>);
      continue;
    }
    // GFM table: header row + separator, then body rows.
    if (looksLikeTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]!).map(alignFromSep);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && looksLikeTableRow(lines[i]!) && !isBlockBoundary(lines[i]!)) {
        if (isTableSeparator(lines[i]!)) break;
        body.push(splitTableRow(lines[i]!));
        i++;
      }
      const tableKey = k++;
      const headCells = header.map((cell, ci) => ({ cell, align: aligns[ci], ci }));
      blocks.push(
        <div key={`table-wrap-${tableKey}`} className="md-table-wrap">
          <table>
            <thead>
              <tr>
                {headCells.map(({ cell, align, ci }) => (
                  <th
                    key={`th-${tableKey}-${ci}-${cell}`}
                    style={align ? { textAlign: align } : undefined}
                  >
                    {inline(cell, `th${tableKey}-${ci}`, wiki)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => {
                const rowKey = `tr-${tableKey}-${ri}-${row.join("\u0001")}`;
                return (
                  <tr key={rowKey}>
                    {headCells.map(({ align, ci }) => (
                      <td key={`${rowKey}-c${ci}`} style={align ? { textAlign: align } : undefined}>
                        {inline(row[ci] ?? "", `td${tableKey}-${ri}-${ci}`, wiki)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlockBoundary(lines[i]!)) {
      // Don't swallow the start of a following table into the paragraph.
      if (looksLikeTableRow(lines[i]!) && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
        break;
      }
      para.push(lines[i]!);
      i++;
    }
    blocks.push(<p key={`p-${k++}`}>{inline(para.join(" "), `p${k}`, wiki)}</p>);
  }
  return <div className="body-md">{blocks}</div>;
}
