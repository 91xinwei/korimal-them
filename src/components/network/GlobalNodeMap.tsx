import { memo, useMemo } from "react";
import { Activity, Cpu, Database, Gauge, MemoryStick, RadioTower, Route, ShieldCheck } from "lucide-react";
import type { NetworkAssetNode, VpsNode } from "@/types/network";
import { NodeGeoPanel } from "@/components/node/NodeGeoPanel";

export const GlobalNodeMap = memo(function GlobalNodeMap({
  nodes,
  defaultZoom,
  selectedNodeId,
  onNodeClick,
}: {
  nodes: NetworkAssetNode[];
  defaultZoom: number;
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
}) {
  const mapped = nodes.filter(
    (node) => node.latitude != null && node.longitude != null,
  ).length;
  const online = nodes.filter((node) => node.status !== "offline").length;
  const latencyValues = nodes.flatMap((node) => node.latency == null ? [] : [node.latency]);
  const averageLatency = latencyValues.length > 0
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;
  const links = Math.min(Math.max(0, mapped - 1), 72);
  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes.find((node) => node.type === "vps") ?? nodes[0],
    [nodes, selectedNodeId],
  );
  const vps = selected?.type === "vps" ? selected as VpsNode : null;
  const staticNode = selected?.type === "static" ? selected : null;

  return (
    <section className="global-node-map" aria-label="Global network map">
      <header className="global-node-map-header">
        <div className="global-node-map-title">
          <span className="global-node-map-kicker"><RadioTower size={11} /> Live network mesh</span>
          <strong>Global Network Map</strong>
          <span>{mapped} of {nodes.length} assets mapped</span>
        </div>
        <div className="network-map-legend" aria-label="Map legend">
          <span data-tone="vps"><i />VPS</span>
          <span data-tone="static"><i />Static IP</span>
          <span data-tone="warning"><i />Warning</span>
          <span data-tone="offline"><i />Offline</span>
        </div>
      </header>
      <aside className="network-map-hud" aria-label="Network map status">
        <div><Activity size={13} /><span>Active nodes</span><strong>{online}</strong></div>
        <div><Route size={13} /><span>Live links</span><strong>{links}</strong></div>
        <div><RadioTower size={13} /><span>Avg RTT</span><strong>{averageLatency == null ? "—" : `${averageLatency} ms`}</strong></div>
      </aside>
      {selected && (
        <aside className="network-map-inspector" aria-label="Selected network asset">
          <div className="network-map-inspector-head">
            <span className="network-map-flag">{selected.countryCode || "--"}</span>
            <div><strong>{selected.name}</strong><small>{[selected.city, selected.country].filter(Boolean).join(" · ")}</small></div>
            <i data-status={selected.status} />
          </div>
          <div className="network-map-inspector-badges"><span>{selected.type === "vps" ? "VPS" : "STATIC IP"}</span>{selected.ipv4 && <span>V4</span>}{selected.ipv6 && <span>V6</span>}</div>
          {vps ? (
            <div className="network-map-inspector-grid">
              <div><Cpu size={12} /><span>CPU</span><strong>{vps.cpuPercent?.toFixed(1) ?? "—"}%</strong></div>
              <div><MemoryStick size={12} /><span>内存</span><strong>{vps.memoryTotalMB ? `${Math.round(((vps.memoryUsedMB ?? 0) / vps.memoryTotalMB) * 100)}%` : "—"}</strong></div>
              <div><Database size={12} /><span>磁盘</span><strong>{vps.diskTotalGB ? `${Math.round(((vps.diskUsedGB ?? 0) / vps.diskTotalGB) * 100)}%` : "—"}</strong></div>
              <div><Gauge size={12} /><span>负载</span><strong>{vps.load?.toFixed(2) ?? "—"}</strong></div>
              <div className="is-wide"><Activity size={12} /><span>上下行</span><strong>{vps.uploadSpeedKB?.toFixed(1) ?? "—"} / {vps.downloadSpeedKB?.toFixed(1) ?? "—"} KB/s</strong></div>
              <div><Route size={12} /><span>TCP / UDP</span><strong>{vps.tcpConnections ?? "—"} / {vps.udpConnections ?? "—"}</strong></div>
              <div><RadioTower size={12} /><span>平均 RTT</span><strong>{selected.latency == null ? "—" : `${Math.round(selected.latency)} ms`}</strong></div>
            </div>
          ) : staticNode ? (
            <div className="network-map-inspector-grid">
              <div className="is-wide"><ShieldCheck size={12} /><span>风险等级</span><strong>{staticNode.riskScore == null ? "—" : `${staticNode.riskScore} / 100`}</strong></div>
              <div><RadioTower size={12} /><span>RTT</span><strong>{staticNode.latency == null ? "—" : `${Math.round(staticNode.latency)} ms`}</strong></div>
              <div><Activity size={12} /><span>丢包</span><strong>{staticNode.packetLoss == null ? "—" : `${staticNode.packetLoss.toFixed(1)}%`}</strong></div>
            </div>
          ) : null}
          <div className="network-map-inspector-freshness">最后更新 {selected.updatedAt ? new Date(selected.updatedAt).toLocaleTimeString("zh-CN", { hour12: false }) : "实时"}</div>
        </aside>
      )}
      <div className="network-map-reticle" aria-hidden="true" />
      <NodeGeoPanel nodes={nodes} defaultZoom={defaultZoom} onNodeClick={onNodeClick} />
      <p className="global-node-map-hint"><span>Interactive telemetry</span> Drag to rotate · scroll/pinch to zoom · select a node to locate its card</p>
    </section>
  );
});
