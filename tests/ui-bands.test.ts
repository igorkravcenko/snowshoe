import { describe, expect, test } from "bun:test";
import { bandFor, colorFor, nodeFloat, targetLayerColors, targetTitle } from "../ui/src/bands.ts";

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

  test("nodeFloat min remains for callers; missing is unknown gray", () => {
    expect(nodeFloat(undefined)).toBeNull();
    expect(nodeFloat({ overview: 0.9, internals: 0.2 })).toBe(0.2);
    expect(colorFor(0.2)).toBe("#f07178");
    expect(colorFor(null)).toBe("#6b7280");
  });

  test("partial vs solid stay distinct on the red→green ramp", () => {
    expect(colorFor(0.5)).toBe("#e6c84a");
    expect(colorFor(0.9)).toBe("#7fd962");
    expect(colorFor(0.5)).not.toBe(colorFor(0.9));
    expect(colorFor(0.3)).toBe("#ff9e64");
  });

  test("bullseye layers: overview outer, contracts mid, internals core", () => {
    const colors = targetLayerColors({
      overview: 0.9,
      contracts: 0.4,
      internals: 0.1,
    });
    expect(colors.overview).toBe(colorFor(0.9));
    expect(colors.contracts).toBe(colorFor(0.4));
    expect(colors.internals).toBe(colorFor(0.1));
    expect(targetLayerColors(undefined).overview).toBe(colorFor(null));
    expect(targetTitle({ overview: 0.9, contracts: 0.4 })).toContain("internals: — (unknown)");
    expect(targetTitle({ overview: 0.9, contracts: 0.4 })).toContain("overview: 0.90 (solid)");
  });
});
