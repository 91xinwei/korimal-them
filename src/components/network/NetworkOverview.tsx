import { memo, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  Clock3,
  Cloud,
  Globe2,
  HouseWifi,
  Radio,
  WifiOff,
} from "lucide-react";
import type { NetworkAssetNode, VpsNode } from "@/types/network";

function compactNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function monthlyCost(nodes: NetworkAssetNode[]) {
  const priced = nodes.filter(
    (node): node is NetworkAssetNode & { monthlyPrice: number; currency: string } =>
      node.monthlyPrice != null && Number.isFinite(node.monthlyPrice) && Boolean(node.currency),
  );
  if (priced.length === 0) return "--";
  const currencies = new Set(priced.map((node) => node.currency));
  if (currencies.size !== 1) return "Mixed";
  const currency = priced[0].currency;
  const total = priced.reduce((sum, node) => sum + node.monthlyPrice, 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(total);
  } catch {
    return `${currency} ${compactNumber(total, 2)}`;
  }
}

export const NetworkOverview = memo(function NetworkOverview({
  nodes,
  loading = false,
  showMonthlyPrice = true,
}: {
  nodes: NetworkAssetNode[];
  loading?: boolean;
  showMonthlyPrice?: boolean;
}) {
  const stats = useMemo(() => {
    const vps = nodes.filter((node): node is VpsNode => node.type === "vps");
    const latencies = nodes
      .map((node) => node.latency)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const trafficValues = vps
      .map((node) => (node.trafficOutGB ?? 0) + (node.trafficInGB ?? 0))
      .filter((value) => Number.isFinite(value));
    return {
      total: nodes.length,
      vps: vps.length,
      static: nodes.length - vps.length,
      online: nodes.filter((node) => node.status === "online").length,
      warning: nodes.filter((node) => node.status === "warning").length,
      offline: nodes.filter((node) => node.status === "offline").length,
      traffic:
        trafficValues.length > 0
          ? `${compactNumber(trafficValues.reduce((sum, value) => sum + value, 0))} GB`
          : "--",
      latency:
        latencies.length > 0
          ? `${Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)} ms`
          : "--",
      cost: showMonthlyPrice ? monthlyCost(nodes) : "Hidden",
    };
  }, [nodes, showMonthlyPrice]);

  const items = [
    { label: "Total Nodes", value: stats.total, icon: Globe2, tone: "neutral" },
    { label: "VPS", value: stats.vps, icon: Cloud, tone: "vps" },
    { label: "Static IP", value: stats.static, icon: HouseWifi, tone: "static" },
    { label: "Online", value: stats.online, icon: Activity, tone: "online" },
    { label: "Warning", value: stats.warning, icon: AlertTriangle, tone: "warning" },
    { label: "Offline", value: stats.offline, icon: WifiOff, tone: "offline" },
    { label: "Total Traffic", value: stats.traffic, icon: Radio, tone: "vps" },
    { label: "Average RTT", value: stats.latency, icon: Clock3, tone: "warning" },
    { label: "Monthly Cost", value: stats.cost, icon: CircleDollarSign, tone: "static" },
  ] as const;

  return (
    <section className="network-overview" aria-label="Network overview">
      <header className="network-overview-heading">
        <div><span>GLOBAL NETWORK</span><strong>全球网络状态</strong></div>
        <em><i />实时刷新</em>
      </header>
      {items.map(({ label, value, icon: Icon, tone }) => (
        <article key={label} className="network-overview-card" data-tone={tone} aria-busy={loading}>
          <span className="network-overview-icon"><Icon size={15} strokeWidth={2} /></span>
          <span className="network-overview-copy">
            <span>{label}</span>
            <strong className={loading ? "network-skeleton-text" : ""}>{loading ? "--" : value}</strong>
          </span>
        </article>
      ))}
    </section>
  );
});
