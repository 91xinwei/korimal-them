import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CircleGauge,
  CloudOff,
  HardDrive,
  MemoryStick,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import type { NodeDisplay } from "@/types/komari";
import { getPingMiniSnapshot } from "@/hooks/usePingMini";
import { loadMetricHealthSummaries } from "@/services/metrics";
import { formatBytes, getExpireDaysRemaining } from "@/utils/format";

const RANGE_OPTIONS = [
  { hours: 24, label: "24 小时" },
  { hours: 168, label: "7 天" },
  { hours: 720, label: "30 天" },
] as const;

function trafficUsagePercent(node: NodeDisplay) {
  if (node.traffic_limit <= 0) return null;
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

function RiskList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; name: string; value: string; tone?: "warn" | "danger" }>;
}) {
  return (
    <div className="health-risk-group">
      <div className="health-risk-title">{icon}<span>{title}</span><b>{items.length}</b></div>
      {items.length > 0 ? (
        <div className="health-risk-list">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="health-risk-row" data-tone={item.tone ?? "warn"}>
              <span title={item.name}>{item.name}</span>
              <strong className="tabular">{item.value}</strong>
            </div>
          ))}
        </div>
      ) : <div className="health-risk-empty">当前没有明显异常</div>}
    </div>
  );
}

export function HealthSummaryPanel({ nodes }: { nodes: NodeDisplay[] }) {
  const [hours, setHours] = useState(24);
  const uuidKey = useMemo(() => nodes.map((node) => node.uuid).sort().join("|"), [nodes]);
  const historyQuery = useQuery({
    queryKey: ["health-summary", uuidKey, hours],
    queryFn: async () => {
      try {
        return {
          source: "metric" as const,
          summaries: await loadMetricHealthSummaries(
            nodes.map((node) => node.uuid),
            hours,
          ),
        };
      } catch {
        return { source: "live" as const, summaries: new Map() };
      }
    },
    staleTime: 60_000,
    enabled: nodes.length > 0,
  });

  const rows = useMemo(() => nodes.map((node) => {
    const history = historyQuery.data?.summaries.get(node.uuid);
    const ping = getPingMiniSnapshot(node.uuid);
    return {
      node,
      cpu: history?.cpuPeak ?? node.cpuPct,
      memory: history?.memoryPeak ?? node.ramPct,
      disk: history?.diskPeak ?? node.diskPct,
      latency: history?.avgLatency ?? ping.lastValue,
      loss: history?.avgLoss ?? ping.loss,
      traffic: trafficUsagePercent(node),
      expireDays: getExpireDaysRemaining(node.expired_at),
    };
  }), [historyQuery.data, nodes]);

  const offline = rows.filter((row) => row.node.online === false);
  const cpuRisks = [...rows].filter((row) => row.cpu >= 80).sort((a, b) => b.cpu - a.cpu);
  const memoryRisks = [...rows].filter((row) => row.memory >= 85).sort((a, b) => b.memory - a.memory);
  const diskRisks = [...rows].filter((row) => row.disk >= 85).sort((a, b) => b.disk - a.disk);
  const networkRisks = [...rows]
    .filter((row) => (row.loss ?? 0) >= 5 || (row.latency ?? 0) >= 200)
    .sort((a, b) => (b.loss ?? 0) - (a.loss ?? 0) || (b.latency ?? 0) - (a.latency ?? 0));
  const quotaRisks = [...rows]
    .filter((row) => (row.traffic ?? 0) >= 80)
    .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0));
  const expiring = [...rows]
    .filter((row) => row.expireDays != null && row.expireDays < 36_500 && row.expireDays <= 30)
    .sort((a, b) => (a.expireDays ?? Infinity) - (b.expireDays ?? Infinity));
  const messages = rows.filter((row) => row.node.message.trim());
  const riskNodeIds = new Set([
    ...offline, ...cpuRisks, ...memoryRisks, ...diskRisks,
    ...networkRisks, ...quotaRisks, ...expiring, ...messages,
  ].map((row) => row.node.uuid));
  const healthy = Math.max(0, nodes.length - riskNodeIds.size);

  return (
    <section className="operations-panel health-summary-panel" aria-label="健康摘要">
      <div className="operations-panel-head">
        <div>
          <div className="operations-panel-title"><Activity size={17} />健康摘要与异常集中</div>
          <p>集中查看离线、资源、网络、流量和到期风险。</p>
        </div>
        <div className="health-range-controls">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.hours}
              type="button"
              data-active={hours === option.hours ? "true" : "false"}
              onClick={() => setHours(option.hours)}
            >
              {option.label}
            </button>
          ))}
          <span title={historyQuery.data?.source === "metric" ? "Metric Store 历史峰值" : "旧核心回退为实时状态"}>
            {historyQuery.isFetching ? <RefreshCw size={12} className="animate-spin" /> : null}
            {historyQuery.data?.source === "metric" ? "历史峰值" : "实时状态"}
          </span>
        </div>
      </div>

      <div className="health-summary-strip">
        <div><span>健康节点</span><strong>{healthy}</strong><small>/ {nodes.length}</small></div>
        <div data-tone="danger"><span>离线</span><strong>{offline.length}</strong><small>台</small></div>
        <div data-tone="warn"><span>资源告警</span><strong>{new Set([...cpuRisks, ...memoryRisks, ...diskRisks].map((row) => row.node.uuid)).size}</strong><small>台</small></div>
        <div data-tone="warn"><span>网络风险</span><strong>{networkRisks.length}</strong><small>台</small></div>
        <div><span>探针消息</span><strong>{messages.length}</strong><small>条</small></div>
      </div>

      {messages.length > 0 && (
        <div className="health-message-list">
          {messages.slice(0, 6).map(({ node }) => (
            <div key={node.uuid}><AlertTriangle size={13} /><strong>{node.name}</strong><span>{node.message}</span></div>
          ))}
        </div>
      )}

      <div className="health-risk-grid">
        <RiskList
          title="离线节点"
          icon={<CloudOff size={14} />}
          items={offline.map(({ node }) => ({ id: node.uuid, name: node.name, value: "离线", tone: "danger" }))}
        />
        <RiskList
          title="CPU 峰值"
          icon={<CircleGauge size={14} />}
          items={cpuRisks.map(({ node, cpu }) => ({ id: node.uuid, name: node.name, value: `${cpu.toFixed(1)}%`, tone: cpu >= 95 ? "danger" : "warn" }))}
        />
        <RiskList
          title="内存压力"
          icon={<MemoryStick size={14} />}
          items={memoryRisks.map(({ node, memory }) => ({ id: node.uuid, name: node.name, value: `${memory.toFixed(1)}%`, tone: memory >= 95 ? "danger" : "warn" }))}
        />
        <RiskList
          title="磁盘压力"
          icon={<HardDrive size={14} />}
          items={diskRisks.map(({ node, disk }) => ({ id: node.uuid, name: node.name, value: `${disk.toFixed(1)}%`, tone: disk >= 95 ? "danger" : "warn" }))}
        />
        <RiskList
          title="网络质量"
          icon={<RadioTower size={14} />}
          items={networkRisks.map(({ node, latency, loss }) => ({
            id: node.uuid,
            name: node.name,
            value: `${loss?.toFixed(1) ?? "-"}% · ${latency != null ? `${Math.round(latency)}ms` : "-"}`,
            tone: (loss ?? 0) >= 20 ? "danger" : "warn",
          }))}
        />
        <RiskList
          title="流量与到期"
          icon={<AlertTriangle size={14} />}
          items={[
            ...quotaRisks.map(({ node, traffic }) => ({ id: `traffic-${node.uuid}`, name: node.name, value: `流量 ${traffic?.toFixed(1)}%`, tone: "warn" as const })),
            ...expiring.map(({ node, expireDays }) => ({ id: `expire-${node.uuid}`, name: node.name, value: expireDays != null && expireDays < 0 ? "已过期" : `${expireDays} 天`, tone: expireDays != null && expireDays <= 7 ? "danger" as const : "warn" as const })),
          ]}
        />
      </div>

      <div className="health-capacity-note">
        总内存 {formatBytes(nodes.reduce((sum, node) => sum + node.ramTotal, 0))} · 总硬盘 {formatBytes(nodes.reduce((sum, node) => sum + node.diskTotal, 0))}
      </div>
    </section>
  );
}
