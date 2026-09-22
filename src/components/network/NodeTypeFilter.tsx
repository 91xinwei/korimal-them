import { memo } from "react";
import type { NetworkAssetNode, NodeTypeFilter as FilterValue } from "@/types/network";

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "vps", label: "VPS" },
  { value: "static", label: "Static IP" },
  { value: "warning", label: "Warning" },
];

export const NodeTypeFilter = memo(function NodeTypeFilter({
  value,
  nodes,
  onChange,
}: {
  value: FilterValue;
  nodes: NetworkAssetNode[];
  onChange: (value: FilterValue) => void;
}) {
  const counts: Record<FilterValue, number> = {
    all: nodes.length,
    vps: nodes.filter((node) => node.type === "vps").length,
    static: nodes.filter((node) => node.type === "static").length,
    warning: nodes.filter((node) => node.status === "warning").length,
  };

  return (
    <nav className="node-type-filter" aria-label="Network asset filter">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          data-active={value === filter.value ? "true" : "false"}
          data-filter={filter.value}
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
        >
          <span>{filter.label}</span>
          <strong>{counts[filter.value]}</strong>
        </button>
      ))}
    </nav>
  );
});
