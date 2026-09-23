import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCanSeeHiddenNodes, useVisibleNodes } from "@/hooks/useNode";
import { useHomepagePingOverviewForNodes } from "@/hooks/usePingMini";
import { usePreferences } from "@/hooks/usePreferences";
import { useNodeSort } from "@/hooks/useNodeSort";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useVisualStyle } from "@/hooks/useVisualStyle";
import { useNetworkAssets } from "@/hooks/useNetworkAssets";
import { useNetworkSettings } from "@/hooks/useNetworkSettings";
import { NetworkOverview } from "@/components/network/NetworkOverview";
import { CarrierNetworkPanel } from "@/components/network/CarrierNetworkPanel";
import { NodeTypeFilter } from "@/components/network/NodeTypeFilter";
import { getSnapshot } from "@/services/wsStore";
import type { NodeDisplay } from "@/types/komari";
import type { NetworkAssetNode, NodeTypeFilter as NetworkNodeTypeFilter } from "@/types/network";
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
import { StaticIpCard } from "./StaticIpCard";
import { StatusOverview } from "./StatusOverview";
import { VisitorInfo } from "./VisitorInfo";
import {
  HomeExplorerToolbar,
  type HomeOperationTool,
  type HomeQuickFilter,
} from "./HomeExplorerToolbar";

const GlobalNodeMap = lazy(() =>
  import("@/components/network/GlobalNodeMap").then((module) => ({ default: module.GlobalNodeMap })),
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

function matchesNetworkAssetSearch(node: NetworkAssetNode, query: string) {
  const keyword = query.trim().toLocaleLowerCase("zh-CN");
  if (!keyword) return true;
  return [
    node.name,
    node.country,
    node.countryCode,
    node.city,
    node.provider,
    node.ipv4,
    node.ipv6,
    node.type === "static" ? node.isp : undefined,
    node.type === "static" ? node.asn : undefined,
  ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(keyword));
}

function matchesAssetType(node: NetworkAssetNode, filter: NetworkNodeTypeFilter) {
  if (filter === "all") return true;
  if (filter === "warning") return node.status === "warning";
  return node.type === filter;
}

function nodeDomId(nodeId: string) {
  return `network-node-${nodeId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function NodeGrid() {
  const nodes = useVisibleNodes();
  const includeHiddenNodes = useCanSeeHiddenNodes();
  const { data: config } = usePublicConfig();
  const { nodeSort } = useNodeSort();
  const { visualStyle } = useVisualStyle();
  const networkSettings = useNetworkSettings();
  const networkAssets = useNetworkAssets(nodes, networkSettings);
  const { resolvedAppearance } = usePreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeGroup, setActiveGroup] = useState("all");
  const [quickFilter, setQuickFilter] = useState<HomeQuickFilter>("all");
  const [activeTool, setActiveTool] = useState<HomeOperationTool>(null);
  const [assetFilter, setAssetFilter] = useState<NetworkNodeTypeFilter>("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
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
  const vpsAssetsById = useMemo(
    () => new Map(networkAssets.vpsNodes.map((node) => [node.id, node])),
    [networkAssets.vpsNodes],
  );
  const filteredVpsDisplays = useMemo(
    () => filteredNodes.filter((node) => {
      const asset = vpsAssetsById.get(node.uuid);
      return asset ? matchesAssetType(asset, assetFilter) : assetFilter === "all" || assetFilter === "vps";
    }),
    [assetFilter, filteredNodes, vpsAssetsById],
  );
  const staticSearchNodes = useMemo(
    () => networkAssets.staticNodes.filter((node) => matchesNetworkAssetSearch(node, deferredSearchQuery)),
    [deferredSearchQuery, networkAssets.staticNodes],
  );
  const filterCandidates = useMemo(
    () => [
      ...filteredNodes.map((node) => vpsAssetsById.get(node.uuid)).filter((node): node is NonNullable<typeof node> => Boolean(node)),
      ...staticSearchNodes,
    ],
    [filteredNodes, staticSearchNodes, vpsAssetsById],
  );
  const filteredNetworkAssets = useMemo(
    () => filterCandidates.filter((node) => matchesAssetType(node, assetFilter)),
    [assetFilter, filterCandidates],
  );
  const filteredStaticNodes = useMemo(
    () => staticSearchNodes.filter((node) => matchesAssetType(node, assetFilter)),
    [assetFilter, staticSearchNodes],
  );
  const visibleNodeKey = useMemo(
    () => filteredVpsDisplays.map((node) => node.uuid).join("|"),
    [filteredVpsDisplays],
  );
  const staticUuids = useMemo(
    () => sortHomepageNodes(filteredVpsDisplays, customOrder, nodeSort),
    [customOrder, filteredVpsDisplays, nodeSortKey],
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

      const available = new Set(filteredVpsDisplays.map((node) => node.uuid));
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
    [filteredVpsDisplays, realtimeUuids, staticUuids, useRealtimeSort],
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

  const handleMapNodeClick = (nodeId: string) => {
    setSelectedAssetId(nodeId);
    document.getElementById(nodeDomId(nodeId))?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!selectedAssetId) return;
    const timer = window.setTimeout(() => setSelectedAssetId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [selectedAssetId]);

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <div className="home-top-stage" data-earth="false">
        <div className="home-top-content">
          {filteredVpsDisplays.length > 0 && (
            <StatusOverview
              nodes={filteredVpsDisplays}
              topInfo={visualStyle.topInfo}
              topInfoProgress={visualStyle.topInfoProgress}
              topInfoSplit={visualStyle.topInfoSplit}
              topInfoOrder={visualStyle.topInfoOrder}
              topInfoColumns={visualStyle.topInfoColumns}
            />
          )}
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
              resultCount={filterCandidates.length}
              totalCount={networkAssets.allNodes.length}
              showVisitorInfo={visualStyle.homeModules.visitorInfo}
            />
          )}
        </div>
      </div>
      {networkSettings.showGlobalMap && (
        <>
          <div className="network-command-center">
            <NetworkOverview
              nodes={networkAssets.allNodes}
              loading={networkAssets.staticLoading && nodes.length === 0}
              showMonthlyPrice={networkSettings.showMonthlyPrice}
            />
            <Suspense fallback={<div className="global-node-map is-loading" aria-busy />}>
              <GlobalNodeMap
                nodes={filteredNetworkAssets}
                defaultZoom={networkSettings.mapDefaultZoom}
                selectedNodeId={selectedAssetId}
                onNodeClick={handleMapNodeClick}
              />
            </Suspense>
          </div>
          <CarrierNetworkPanel
            uuid={(filteredNetworkAssets.find((node) => node.id === selectedAssetId && node.type === "vps") ?? filteredNetworkAssets.find((node) => node.type === "vps"))?.id}
            marqueeStyle={visualStyle.marqueeStyle}
          />
        </>
      )}
      <NodeTypeFilter value={assetFilter} nodes={filterCandidates} onChange={setAssetFilter} />
      {visualStyle.homeModules.explorerToolbar && activeTool && (
        <Suspense fallback={<div className="operations-panel is-loading" aria-busy />}>
          {activeTool === "health" && <HealthSummaryPanel nodes={filteredVpsDisplays} />}
          {activeTool === "topology" && <NodeTopologyPanel nodes={filteredVpsDisplays} />}
          {activeTool === "export" && <SnapshotExportPanel nodes={filteredVpsDisplays} />}
        </Suspense>
      )}
      {networkAssets.staticError && networkSettings.showStaticIps && (
        <div className="network-source-error" role="status">
          <span>Static IP 数据暂不可用，VPS 实时监控不受影响。</span>
          <button type="button" onClick={() => void networkAssets.retryStatic()}>重试</button>
        </div>
      )}
      <div className="network-asset-sections">
          {uuids.length > 0 && (
            <section className="network-asset-section" aria-labelledby="vps-nodes-heading">
              <div className="network-section-heading"><h2 id="vps-nodes-heading">VPS Nodes</h2><span>{uuids.length}</span></div>
              <div
                className={isStripLayout ? "node-card-list is-strip-layout" : "node-card-list is-square-layout"}
                style={isStripLayout ? undefined : { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }}
              >
                {uuids.map((uuid) => (
                  <div key={uuid} id={nodeDomId(uuid)} data-highlight={selectedAssetId === uuid ? "true" : "false"}>
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
                      showMonthlyPrice={networkSettings.showMonthlyPrice}
                      ipQuality={networkAssets.vpsNodes.find((node) => node.id === uuid)?.quality}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
          {networkSettings.showStaticIps && (
            <section className="network-asset-section" aria-labelledby="static-ip-heading">
              <div className="network-section-heading">
                <h2 id="static-ip-heading">Static IP Nodes</h2>
                <span>{filteredStaticNodes.length}</span>
                <Link className="network-source-config-link" to="/?view=theme-manage#static-ip-settings">
                  配置数据源
                </Link>
              </div>
              <div className="node-card-list is-square-layout" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }}>
                {networkAssets.staticLoading && !networkAssets.staticError && filteredStaticNodes.length === 0
                  ? Array.from({ length: 3 }, (_, index) => <div key={index} className="static-ip-card-skeleton" aria-busy />)
                  : filteredStaticNodes.length > 0
                    ? filteredStaticNodes.map((node) => (
                    <div key={node.id} id={nodeDomId(node.id)} data-highlight={selectedAssetId === node.id ? "true" : "false"}>
                      <StaticIpCard node={node} settings={networkSettings} />
                    </div>
                    ))
                    : (
                      <div className="static-ip-empty-state">
                        <strong>尚未添加 Static IP</strong>
                        <span>在主题设置中填写 Provider API URL；保存后会自动刷新并生成卡片。</span>
                        <Link to="/?view=theme-manage#static-ip-settings">立即配置 Static IP 数据源</Link>
                      </div>
                    )}
              </div>
            </section>
          )}
      </div>
    </div>
  );
}
