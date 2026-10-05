import { describe, expect, test } from "bun:test";
import { mapChromeTitle } from "../ui/src/api.ts";

describe("mapChromeTitle", () => {
  test("uses repo basename + map", () => {
    expect(mapChromeTitle("/work/acme")).toBe("acme map");
    expect(mapChromeTitle("/work/acme/")).toBe("acme map");
    expect(mapChromeTitle("C:\\Users\\dev\\acme")).toBe("acme map");
    expect(mapChromeTitle("C:\\Users\\dev\\acme\\")).toBe("acme map");
  });

  test("falls back to map without repoRoot", () => {
    expect(mapChromeTitle(null)).toBe("map");
    expect(mapChromeTitle(undefined)).toBe("map");
    expect(mapChromeTitle("")).toBe("map");
    expect(mapChromeTitle("/")).toBe("map");
  });
});
