import { describe, expect, it } from "vitest";
import { applyAllClientsToTask, applyClientAssignment, countAssignedNodes } from "./pingBindings";
import { selectHomepagePingSeries } from "@/utils/pingTasks";
import { arrangeCarrierPingRows } from "@/utils/carrierPingRows";

describe("homepage Ping multi-task bindings", () => {
  it("keeps existing carrier tasks when a node is assigned to another task", () => {
    const result = applyClientAssignment({ "1": ["node-a"], "2": ["node-a"] }, 3, "node-a", true);

    expect(result).toEqual({
      "1": ["node-a"],
      "2": ["node-a"],
      "3": ["node-a"],
    });
  });

  it("removes a node only from the unchecked task", () => {
    const result = applyClientAssignment({ "1": ["node-a"], "2": ["node-a"] }, 1, "node-a", false);

    expect(result).toEqual({ "2": ["node-a"] });
  });

  it("applies all nodes without clearing other carrier tasks", () => {
    const result = applyAllClientsToTask({ "1": ["node-a"] }, 2, ["node-a", "node-b"]);

    expect(result).toEqual({
      "1": ["node-a"],
      "2": ["node-a", "node-b"],
    });
  });

  it("counts each displayed node once even when three tasks are selected", () => {
    expect(countAssignedNodes({ "3": ["node-a"], "4": ["node-a"], "5": ["node-a", "node-b"] })).toBe(2);
  });

  it("shows only tasks selected for this node while preserving automatic mode for unselected nodes", () => {
    const series = [
      { taskId: 1, taskName: "Cloudflare" },
      { taskId: 3, taskName: "上海电信" },
      { taskId: 4, taskName: "上海联通" },
      { taskId: 5, taskName: "上海移动" },
    ];
    const bindings = { "3": ["node-a"], "4": ["node-a"], "5": ["node-b"] };

    expect(selectHomepagePingSeries("node-a", series, bindings).map((item) => item.taskName)).toEqual(["上海电信", "上海联通"]);
    expect(selectHomepagePingSeries("node-c", series, bindings)).toEqual(series);
  });

  it("does not label Cloudflare or Google as a Shanghai carrier", () => {
    const rows = arrangeCarrierPingRows([
      { taskId: 1, taskName: "Cloudflare", taskTarget: "1.1.1.1" },
      { taskId: 3, taskName: "上海电信", taskTarget: "ct.example" },
    ]);

    expect(rows.map((row) => [row.name, row.item?.taskId])).toEqual([
      ["上海电信", 3],
      ["上海联通", undefined],
      ["上海移动", undefined],
      ["Cloudflare", 1],
    ]);
  });
});
