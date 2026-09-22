import { describe, expect, it } from "vitest";
import { normalizeLatestPingSeries } from "@/hooks/usePingMini";

describe("normalizeLatestPingSeries", () => {
  it("keeps every official latest-status ping task for a node", () => {
    const series = normalizeLatestPingSeries("node-1", {
      ping: {
        "11": { name: "上海电信", latest: 30, avg: 35, loss: 1.7, min: 25, max: 80 },
        "12": { name: "上海联通", latest: 58, avg: 61, loss: 35, min: 48, max: 120 },
        "13": { name: "上海移动", latest: 50, avg: 54, loss: 13.3, min: 41, max: 99 },
      },
    });

    expect(series.map((item) => item.taskName)).toEqual([
      "上海电信",
      "上海联通",
      "上海移动",
    ]);
    expect(series.map((item) => [item.lastValue, item.loss])).toEqual([
      [30, 1.7],
      [58, 35],
      [50, 13.3],
    ]);
  });

  it("falls back to average latency when latest is a loss sample", () => {
    const [item] = normalizeLatestPingSeries("node-1", {
      ping: {
        "7": { name: "上海电信", latest: -1, avg: 42, loss: 100, min: 0, max: 0 },
      },
    });

    expect(item?.lastValue).toBe(42);
    expect(item?.loss).toBe(100);
  });
});
