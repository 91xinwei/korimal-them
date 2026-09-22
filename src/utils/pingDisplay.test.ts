import { describe, expect, it } from "vitest";
import { shouldShowPingMetrics } from "@/utils/pingDisplay";

describe("homepage Ping visibility", () => {
  it("keeps RT and packet-loss fields visible in automatic mode", () => {
    expect(shouldShowPingMetrics("auto", false, false)).toBe(true);
    expect(shouldShowPingMetrics("auto", true, false)).toBe(true);
  });

  it("preserves explicit placeholder and assigned-only modes", () => {
    expect(shouldShowPingMetrics("placeholder", false, false)).toBe(true);
    expect(shouldShowPingMetrics("assigned", true, false)).toBe(false);
    expect(shouldShowPingMetrics("assigned", true, true)).toBe(true);
  });
});
