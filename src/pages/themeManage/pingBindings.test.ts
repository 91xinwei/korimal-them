import { describe, expect, it } from "vitest";
import { applyAllClientsToTask, applyClientAssignment } from "./pingBindings";

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
});
