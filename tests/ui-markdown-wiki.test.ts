import { describe, expect, test } from "bun:test";
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
