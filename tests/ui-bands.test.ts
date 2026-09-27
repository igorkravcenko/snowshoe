import { describe, expect, test } from "bun:test";
import { bandFor, colorFor, nodeFloat } from "../ui/src/bands.ts";

describe("UI display bands (ADR-A thresholds, not stored)", () => {
  test("maps floats to stale/shaky/partial/solid", () => {
    expect(bandFor(0)).toBe("stale");
    expect(bandFor(0.249)).toBe("stale");
    expect(bandFor(0.25)).toBe("shaky");
    expect(bandFor(0.49)).toBe("shaky");
    expect(bandFor(0.5)).toBe("partial");
    expect(bandFor(0.74)).toBe("partial");
    expect(bandFor(0.75)).toBe("solid");
    expect(bandFor(1)).toBe("solid");
    expect(bandFor(null)).toBe("unknown");
    expect(bandFor(1.2)).toBe("unknown");
  });

  test("tree swatch uses min metric; missing is unknown gray", () => {
    expect(nodeFloat(undefined)).toBeNull();
    expect(nodeFloat({ overview: 0.9, internals: 0.2 })).toBe(0.2);
    expect(colorFor(0.2)).toBe("#b45353");
    expect(colorFor(null)).toBe("#6b7280");
  });
});
