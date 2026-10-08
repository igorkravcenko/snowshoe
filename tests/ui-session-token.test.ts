import { describe, expect, test } from "bun:test";
import { parseMapTokenFromHash } from "../src/map/token-hash.ts";

describe("parseMapTokenFromHash", () => {
  const token = "A".repeat(43);

  test("reads #t=<token> and ignores node slugs", () => {
    expect(parseMapTokenFromHash(`#t=${token}`)).toBe(token);
    expect(parseMapTokenFromHash(`t=${token}`)).toBe(token);
    expect(parseMapTokenFromHash("#auth")).toBeNull();
    expect(parseMapTokenFromHash("#")).toBeNull();
    expect(parseMapTokenFromHash("")).toBeNull();
    expect(parseMapTokenFromHash("#t=short")).toBeNull();
  });
});
