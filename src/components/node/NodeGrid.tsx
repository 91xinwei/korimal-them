import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useCanSeeHiddenNodes, useVisibleNodes } from "@/hooks/useNode";
import { useHomepagePingOverviewForNodes } from "@/hooks/usePingMini";
import { usePreferences } from "@/hooks/usePreferences";
import { useNodeSort } from "@/hooks/useNodeSort";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useVisualStyle } from "@/hooks/useVisualStyle";
import { getSnapshot } from "@/services/wsStore";
import type { NodeDisplay } from "@/types/komari";
import { normalizeHomepageNodeOrder } from "@/utils/nodeOrder";
import { getExpireDaysRemaining } from "@/utils/format";
import {
  hasHomepagePingBindings,
  normalizeHomepagePingDisplayMode,
} from "@/utils/pingDisplay";
import {
  isRealtimeNodeSortMode,
  serializeHomepageNodeSortSettings,
  sortHomepageNodes,
} from "@/utils/nodeSort";
import { NodeCard } from "./NodeCard";
import { StatusOverview } from "./StatusOverview";
import { VisitorInfo } from "./VisitorInfo";
import {
  HomeExplorerToolbar,
  type HomeOperationTool,
  type HomeQuickFilter,
} from "./HomeExplorerToolbar";

const NodeGeoPanel = lazy(() =>
  import("./NodeGeoPanel").then((module) => ({ default: module.NodeGeoPanel })),
);
const HealthSummaryPanel = lazy(() =>
  import("./HealthSummaryPanel").then((module) => ({ default: module.HealthSummaryPanel })),
);
const NodeTopologyPanel = lazy(() =>
  import("./NodeTopologyPanel").then((module) => ({ default: module.NodeTopologyPanel })),
);
const SnapshotExportPanel = lazy(() =>
  import("./SnapshotExportPanel").then((module) => ({ default: module.SnapshotExportPanel })),
);

function getTrafficUsagePercent(node: NodeDisplay) {
  if (node.traffic_limit <= 0) return 0;
  const up = Math.max(0, node.trafficUp || 0);
  const down = Math.max(0, node.trafficDown || 0);
  const type = node.traffic_limit_type.trim().toLowerCase();
  const used = type === "up"
    ? up
    : type === "down"
      ? down
      : type === "max"
        ? Math.max(up, down)
        : type === "min"
          ? Math.min(up, down)
          : up + down;
  return (used / node.traffic_limit) * 100;
}

function matchesQuickFilter(
  node: NodeDisplay,
  filter: HomeQuickFilter,
) {
  if (filter === "online") return node.online === true;
  if (filter === "offline") return node.online === false;
  if (filter === "highLoad") {
    return node.cpuPct >= 80 || node.load1 >= Math.max(1, node.cpu_cores || 1);
  }
  if (filter === "resource") return node.ramPct >= 85 || node.diskPct >= 85;
  if (filter === "traffic") return getTrafficUsagePercent(node) >= 80;
  if (filter === "expiring") {
    const days = getExpireDaysRemaining(node.expired_at);
    return days != null && days < 36_500 && days <= 30;
  }
  if (filter === "message") return Boolean(node.message.trim());
  return true;
}

function matchesNodeSearch(
  node: NodeDisplay,
  query: string,
) {
  const keyword = query.trim().toLocaleLowerCase("zh-CN");
  if (!keyword) return true;
  return [
    node.name,
    node.region,
    node.os,
    node.arch,
    node.virtualization,
    node.group,
    node.tags,
    node.public_remark,
    node.cpu_name,
    node.message,
  ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(keyword));
}

export function NodeGrid() {
  const nodes = useVisibleNodes();
  const includeHiddenNodes = useCanSeeHiddenNodes();
  const { data: config } = usePublicConfig();
  const { nodeSort } = useNodeSort();
  const { visualStyle } = useVisualStyle();
  const { resolvedAppearance } = usePreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeGroup, setActiveGroup] = useState("all");
  const [quickFilter, setQuickFilter] = useState<HomeQuickFilter>("all");
  const [activeTool, setActiveTool] = useState<HomeOperationTool>(null);
  const pingDisplayMode = useMemo(
    () => normalizeHomepagePingDisplayMode(config?.theme_settings?.homepagePingDisplayMode),
    [config?.theme_settings?.homepagePingDisplayMode],
  );
  const hasAnyHomepagePingBinding = useMemo(
    () => hasHomepagePingBindings(config?.theme_settings?.homepagePingBindings),
    [config?.theme_settings?.homepagePingBindings],
  );
  const customOrder = useMemo(
    () => normalizeHomepageNodeOrder(config?.theme_settings?.homepageNodeOrder),
    [config?.theme_settings?.homepageNodeOrder],
  );
  const nodeSortKey = useMemo(
    () => serializeHomepageNodeSortSettings(nodeSort),
    [nodeSort],
  );
  const groups = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.group?.trim()).filter((group): group is string => Boolean(group)))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [nodes],
  );
  useEffect(() => {
    if (activeGroup !== "all" && !groups.includes(activeGroup)) setActiveGroup("all");
  }, [activeGroup, groups]);
  useEffect(() => {
    if (visualStyle.homeModules.explorerToolbar) return;
    setSearchQuery("");
    setActiveGroup("all");
    setQuickFilter("all");
    setActiveTool(null);
  }, [visualStyle.homeModules.explorerToolbar]);
  const baseFilteredNodes = useMemo(
    () => nodes.filter((node) =>
      (activeGroup === "all" || node.group?.trim() === activeGroup) &&
      matchesNodeSearch(node, deferredSearchQuery)),
    [activeGroup, deferredSearchQuery, nodes],
  );
  const quickFilterCounts = useMemo(
    () => ({
      all: baseFilteredNodes.length,
      online: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "online")).length,
      offline: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "offline")).length,
      highLoad: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "highLoad")).length,
      resource: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "resource")).length,
      traffic: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "traffic")).length,
      expiring: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "expiring")).length,
      message: baseFilteredNodes.filter((node) => matchesQuickFilter(node, "message")).length,
    }),
    [baseFilteredNodes],
  );
  const filteredNodes = useMemo(
    () => baseFilteredNodes.filter((node) => matchesQuickFilter(node, quickFilter)),
    [baseFilteredNodes, quickFilter],
  );
  const visibleNodeKey = useMemo(
    () => filteredNodes.map((node) => node.uuid).join("|"),
    [filteredNodes],
  );
  const staticUuids = useMemo(
    () => sortHomepageNodes(filteredNodes, customOrder, nodeSort),
    [customOrder, filteredNodes, nodeSortKey],
  );
  const [realtimeUuids, setRealtimeUuids] = useState<string[]>([]);
  const useRealtimeSort = isRealtimeNodeSortMode(nodeSort.mode);

  useEffect(() => {
    if (!useRealtimeSort) {
      setRealtimeUuids([]);
      return;
    }

    const updateRealtimeOrder = () => {
      const snapshot = getSnapshot();
      const liveNodes = snapshot.order
        .map((uuid) => snapshot.byUuid[uuid])
        .filter(
          (node): node is NonNullable<typeof node> =>
            Boolean(node) &&
            (includeHiddenNodes || !node.hidden) &&
            (activeGroup === "all" || node.group?.trim() === activeGroup) &&
            matchesNodeSearch(node, deferredSearchQuery) &&
            matchesQuickFilter(node, quickFilter),
        );
      setRealtimeUuids(sortHomepageNodes(liveNodes, customOrder, nodeSort));
    };

    updateRealtimeOrder();
    const timer = window.setInterval(
      updateRealtimeOrder,
      nodeSort.realtimeIntervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [activeGroup, customOrder, deferredSearchQuery, includeHiddenNodes, nodeSortKey, quickFilter, useRealtimeSort, visibleNodeKey]);

  const uuids = useMemo(
    () => {
      if (!useRealtimeSort || realtimeUuids.length === 0) return staticUuids;

      const available = new Set(filteredNodes.map((node) => node.uuid));
      const seen = new Set<string>();
      const reconciled: string[] = [];

      for (const uuid of realtimeUuids) {
        if (!available.has(uuid) || seen.has(uuid)) continue;
        seen.add(uuid);
        reconciled.push(uuid);
      }

      for (const uuid of staticUuids) {
        if (seen.has(uuid)) continue;
        seen.add(uuid);
        reconciled.push(uuid);
      }

      return reconciled;
    },
    [filteredNodes, realtimeUuids, staticUuids, useRealtimeSort],
  );
  const visualRedrawKey = useMemo(
    () =>
      [
        resolvedAppearance,
        visualStyle.marqueeStyle.shape,
        visualStyle.marqueeStyle.density,
        visualStyle.marqueeStyle.radius,
        visualStyle.marqueeStyle.glow,
        visualStyle.marqueeStyle.motion,
        visualStyle.colors.cpu,
        visualStyle.colors.memory,
        visualStyle.colors.disk,
        visualStyle.colors.load,
        visualStyle.colors.latency,
        visualStyle.colors.loss,
        visualStyle.colors.up,
        visualStyle.colors.down,
        visualStyle.colors.peak,
        visualStyle.colors.idle,
      ].join("|"),
    [
      resolvedAppearance,
      visualStyle.colors.cpu,
      visualStyle.colors.disk,
      visualStyle.colors.down,
      visualStyle.colors.idle,
      visualStyle.colors.latency,
      visualStyle.colors.load,
      visualStyle.colors.loss,
      visualStyle.colors.memory,
      visualStyle.colors.peak,
      visualStyle.colors.up,
      visualStyle.marqueeStyle.density,
      visualStyle.marqueeStyle.glow,
      visualStyle.marqueeStyle.motion,
      visualStyle.marqueeStyle.radius,
      visualStyle.marqueeStyle.shape,
    ],
  );
  const isStripLayout = visualStyle.cardLayout === "strip";
  useHomepagePingOverviewForNodes(uuids);

  if (nodes.length === 0) {
    return (
      <>
        {visualStyle.homeModules.visitorInfo && <VisitorInfo showTrigger={false} />}
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
          <span className="text-[15px]">尚未连接到任何节点</span>
          <span className="text-[12px]">等待后端推送或前往管理后台添加</span>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <div className="home-top-stage" data-earth={visualStyle.homeModules.mapEnabled ? "true" : "false"}>
        <div className="home-top-content">
          <StatusOverview
            nodes={filteredNodes}
            topInfo={visualStyle.topInfo}
            topInfoProgress={visualStyle.topInfoProgress}
            topInfoSplit={visualStyle.topInfoSplit}
            topInfoOrder={visualStyle.topInfoOrder}
            topInfoColumns={visualStyle.topInfoColumns}
          />
          {!visualStyle.homeModules.explorerToolbar && visualStyle.homeModules.visitorInfo && (
            <VisitorInfo showTrigger={false} />
          )}
          {visualStyle.homeModules.explorerToolbar && (
            <HomeExplorerToolbar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              groups={groups}
              activeGroup={activeGroup}
              onGroupChange={setActiveGroup}
              filter={quickFilter}
              onFilterChange={setQuickFilter}
              counts={quickFilterCounts}
              activeTool={activeTool}
              onToolChange={setActiveTool}
              resultCount={filteredNodes.length}
              totalCount={nodes.length}
              showVisitorInfo={visualStyle.homeModules.visitorInfo}
            />
          )}
        </div>
        {visualStyle.homeModules.mapEnabled && (
          <Suspense fallback={<div className="node-earth-stage is-loading" aria-busy />}>
            <NodeGeoPanel nodes={filteredNodes} />
          </Suspense>
        )}
      </div>
      {visualStyle.homeModules.explorerToolbar && activeTool && (
        <Suspense fallback={<div className="operations-panel is-loading" aria-busy />}>
          {activeTool === "health" && <HealthSummaryPanel nodes={filteredNodes} />}
          {activeTool === "topology" && <NodeTopologyPanel nodes={filteredNodes} />}
          {activeTool === "export" && <SnapshotExportPanel nodes={filteredNodes} />}
        </Suspense>
      )}
      {uuids.length === 0 ? (
        <div className="home-filter-empty">
          <span>没有符合当前搜索或筛选条件的节点</span>
          <button type="button" onClick={() => { setSearchQuery(""); setActiveGroup("all"); setQuickFilter("all"); }}>清除筛选</button>
        </div>
      ) : (
      <div
        className={
          isStripLayout
            ? "node-card-list is-strip-layout"
            : "node-card-list is-square-layout"
        }
        style={
          isStripLayout
            ? undefined
            : { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }
        }
      >
        {uuids.map((uuid) => (
          <div key={uuid}>
            <NodeCard
              uuid={uuid}
              resolvedAppearance={resolvedAppearance}
              cardLayout={visualStyle.cardLayout}
              visualRedrawKey={visualRedrawKey}
              dashboardStyle={visualStyle.dashboardStyle}
              showTrafficQuota={visualStyle.showTrafficQuota}
              pingDisplayMode={pingDisplayMode}
              hasAnyHomepagePingBinding={hasAnyHomepagePingBinding}
              dashboardSettings={visualStyle.dashboardSettings}
              radarLatencyMaxMs={visualStyle.radarLatencyMaxMs}
              marqueeStyle={visualStyle.marqueeStyle}
            />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
