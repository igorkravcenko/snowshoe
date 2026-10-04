import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { isTableSeparator, MarkdownBody, splitTableRow } from "../ui/src/markdown.tsx";
import { parseWikiLink, resolveWikiLink } from "../ui/src/wiki.ts";

describe("wiki links", () => {
  test("parseWikiLink handles slug and label", () => {
    expect(parseWikiLink("auth")).toEqual({ slug: "auth", label: "auth" });
    expect(parseWikiLink("login-flow|Login")).toEqual({ slug: "login-flow", label: "Login" });
    expect(parseWikiLink("Not A slug")).toBeNull();
  });

  test("resolveWikiLink marks missing targets", () => {
    const known = resolveWikiLink("auth", "auth", (s) => (s === "auth" ? "Auth" : undefined));
    expect(known).toEqual({ slug: "auth", text: "Auth", missing: false });
    const labeled = resolveWikiLink("auth", "Login", (s) => (s === "auth" ? "Auth" : undefined));
    expect(labeled).toEqual({ slug: "auth", text: "Login", missing: false });
    const missing = resolveWikiLink("no-such", "no-such", () => undefined);
    expect(missing.missing).toBe(true);
    expect(missing.text).toBe("no-such");
  });
});

describe("GFM tables", () => {
  test("splitTableRow and separator detection", () => {
    expect(splitTableRow("| a | b |")).toEqual(["a", "b"]);
    expect(splitTableRow("a | b")).toEqual(["a", "b"]);
    expect(isTableSeparator("| --- | :---: | ---: |")).toBe(true);
    expect(isTableSeparator("| foo | bar |")).toBe(false);
  });

  test("MarkdownBody renders a pipe table as HTML table", () => {
    const md = ["| Name | Role |", "| --- | --- |", "| [[auth]] | gate |", "| root | top |"].join(
      "\n",
    );
    const html = renderToStaticMarkup(
      <MarkdownBody text={md} titleForSlug={(s) => (s === "auth" ? "Auth" : undefined)} />,
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("Auth");
    expect(html).toContain("gate");
    expect(html).not.toContain("| --- |");
  });
});
