import { describe, expect, test } from "bun:test";
import { allowedChildTypes } from "../src/domain/matrix.ts";

describe("child type matrix", () => {
  test("symbol may have symbol children unless leaf", () => {
    expect(allowedChildTypes("symbol", false)).toEqual(["symbol"]);
    expect(allowedChildTypes("symbol", true)).toEqual([]);
  });
});
