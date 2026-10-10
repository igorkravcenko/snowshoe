import { describe, expect, test } from "bun:test";
import { beginViewBoot, cancelViewBoot, failViewBoot } from "../ui/src/view-boot.ts";

describe("view boot latch", () => {
  test("selected-churn cancel before viewId allows retry (regression)", () => {
    const latch = { claimed: false };
    expect(beginViewBoot(latch, true, null)).toBe(true);
    // Former bug: effect deps included `selected`, cleanup cancelled the async
    // create, but the latch stayed claimed so the re-run skipped forever.
    cancelViewBoot(latch, null);
    expect(latch.claimed).toBe(false);
    expect(beginViewBoot(latch, true, null)).toBe(true);
  });

  test("after viewId is committed, cleanup on model refresh does not re-boot", () => {
    const latch = { claimed: false };
    expect(beginViewBoot(latch, true, null)).toBe(true);
    const viewId = "view-abc";
    cancelViewBoot(latch, viewId);
    expect(latch.claimed).toBe(true);
    expect(beginViewBoot(latch, true, viewId)).toBe(false);
  });

  test("createMapView failure releases latch for retry", () => {
    const latch = { claimed: false };
    expect(beginViewBoot(latch, true, null)).toBe(true);
    failViewBoot(latch);
    expect(latch.claimed).toBe(false);
    expect(beginViewBoot(latch, true, null)).toBe(true);
  });

  test("does not start without a model", () => {
    const latch = { claimed: false };
    expect(beginViewBoot(latch, false, null)).toBe(false);
    expect(latch.claimed).toBe(false);
  });
});
