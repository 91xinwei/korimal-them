import {
  Activity,
  Braces,
  Filter,
  Network,
  Search,
  X,
} from "lucide-react";
import { VisitorInfo } from "@/components/node/VisitorInfo";

export type HomeQuickFilter =
  | "all"
  | "online"
  | "offline"
  | "highLoad"
  | "resource"
  | "traffic"
  | "expiring"
  | "message";

export type HomeOperationTool = "health" | "topology" | "export" | null;

const FILTERS: Array<{ id: HomeQuickFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "online", label: "在线" },
  { id: "offline", label: "离线" },
  { id: "highLoad", label: "高负载" },
  { id: "resource", label: "资源预警" },
  { id: "traffic", label: "流量预警" },
  { id: "expiring", label: "即将到期" },
  { id: "message", label: "探针消息" },
];

export function HomeExplorerToolbar({
  query,
  onQueryChange,
  groups,
  activeGroup,
  onGroupChange,
  filter,
  onFilterChange,
  counts,
  activeTool,
  onToolChange,
  resultCount,
  totalCount,
  showVisitorInfo,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  groups: string[];
  activeGroup: string;
  onGroupChange: (value: string) => void;
  filter: HomeQuickFilter;
  onFilterChange: (value: HomeQuickFilter) => void;
  counts: Record<HomeQuickFilter, number>;
  activeTool: HomeOperationTool;
  onToolChange: (value: HomeOperationTool) => void;
  resultCount: number;
  totalCount: number;
  showVisitorInfo: boolean;
}) {
  return (
    <section className="home-explorer-toolbar" aria-label="节点搜索和快捷筛选">
      <div className="home-explorer-main-row">
        <label className="home-node-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索名称、地区、系统、分组、标签、备注"
            aria-label="搜索节点"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} title="清空搜索" aria-label="清空搜索">
              <X size={14} />
            </button>
          )}
        </label>

        <div className="home-operation-buttons" role="group" aria-label="运维工具">
          {([
            ["health", "健康摘要", Activity],
            ["topology", "拓扑分析", Network],
            ["export", "快照导出", Braces],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              data-active={activeTool === id ? "true" : "false"}
              onClick={() => onToolChange(activeTool === id ? null : id)}
              title={label}
              aria-pressed={activeTool === id}
            >
              <Icon size={14} /><span>{label}</span>
            </button>
          ))}
        </div>

        {showVisitorInfo && <VisitorInfo />}
      </div>

      <div className="home-explorer-scroll-row">
        <div className="home-group-tabs" role="tablist" aria-label="节点分组">
          <button type="button" data-active={activeGroup === "all" ? "true" : "false"} onClick={() => onGroupChange("all")}>全部节点</button>
          {groups.map((group) => (
            <button key={group} type="button" data-active={activeGroup === group ? "true" : "false"} onClick={() => onGroupChange(group)}>{group}</button>
          ))}
        </div>
        <div className="home-quick-filters" role="group" aria-label="快捷筛选">
          <span><Filter size={13} />快捷</span>
          {FILTERS.map((item) => (
            <button key={item.id} type="button" data-active={filter === item.id ? "true" : "false"} onClick={() => onFilterChange(item.id)}>
              {item.label}<b>{counts[item.id]}</b>
            </button>
          ))}
        </div>
        <span className="home-filter-result tabular">{resultCount === totalCount ? `${totalCount} 台` : `${resultCount} / ${totalCount} 台`}</span>
      </div>
    </section>
  );
}
