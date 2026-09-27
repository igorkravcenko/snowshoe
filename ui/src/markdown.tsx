import { createElement, type ReactElement, type ReactNode } from "react";

function safeHref(raw: string): string | null {
  const t = raw.trim();
  if (/^(https?:\/\/|\/|#)/i.test(t) && !/^(javascript|data|vbscript):/i.test(t)) {
    return t;
  }
  return null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
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
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    } else if (m[2] !== undefined) {
      const href = safeHref(m[3] ?? "");
      if (href) {
        nodes.push(
          <a key={`${keyPrefix}-a-${i}`} href={href} rel="noreferrer">
            {m[2]}
          </a>,
        );
      } else {
        nodes.push(m[2]);
      }
    }
    last = m.index + token.length;
    i++;
    m = re.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Dumb, HTML-escaping markdown subset for inspector bodies (no editor). */
export function MarkdownBody(props: { text: string }): ReactElement {
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
      blocks.push(createElement(tag, { key: `h-${k++}` }, inline(heading[2]!, `h${k}`)));
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: ReactElement[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(
          <li key={`li-${k}-${i}`}>{inline(lines[i]!.replace(/^[-*]\s+/, ""), `li${i}`)}</li>,
        );
        i++;
      }
      blocks.push(<ul key={`ul-${k++}`}>{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[i]!) &&
      !/^[-*]\s+/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(<p key={`p-${k++}`}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return <div className="body-md">{blocks}</div>;
}
