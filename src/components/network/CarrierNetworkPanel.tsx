import { memo } from "react";
import { RadioTower } from "lucide-react";
import { usePingMiniBuckets, usePingMiniSeries, type PingMiniSeries } from "@/hooks/usePingMini";
import type { MarqueeStyleSettings } from "@/hooks/useVisualStyle";
import { MiniBars } from "@/components/node/MiniBars";
import { QualityBars } from "@/components/node/QualityBars";

const CARRIERS = [
  { name: "上海电信", match: /电信|telecom/i, tone: "telecom" },
  { name: "上海联通", match: /联通|unicom/i, tone: "unicom" },
  { name: "上海移动", match: /移动|mobile|cmcc/i, tone: "mobile" },
] as const;

function CarrierRow({ item, name, tone, marqueeStyle }: { item?: PingMiniSeries; name: string; tone: string; marqueeStyle: MarqueeStyleSettings }) {
  const buckets = usePingMiniBuckets(item ?? { samples: [] });
  return (
    <div className="carrier-network-row" data-tone={tone}>
      <div className="carrier-network-name"><i /><strong>{item?.taskName || name}</strong><small>{item?.taskTarget || "等待监测任务"}</small></div>
      <div className="carrier-network-value"><span>RT</span><strong>{item?.lastValue == null ? "—" : Math.round(item.lastValue)}<small>{item?.lastValue == null ? "" : "ms"}</small></strong></div>
      <div className="carrier-network-value"><span>丢包率</span><strong>{item?.loss == null ? "—" : item.loss.toFixed(1)}<small>{item?.loss == null ? "" : "%"}</small></strong></div>
      <div className="carrier-network-trend"><MiniBars values={item?.values ?? []} max={item?.max ?? 1} lastValue={item?.lastValue ?? undefined} buckets={buckets} marqueeStyle={marqueeStyle} color="var(--carrier-tone)" /></div>
      <div className="carrier-network-loss"><QualityBars value={item?.loss} buckets={buckets} marqueeStyle={marqueeStyle} color="var(--carrier-loss)" /></div>
    </div>
  );
}

export const CarrierNetworkPanel = memo(function CarrierNetworkPanel({ uuid, marqueeStyle }: { uuid?: string; marqueeStyle: MarqueeStyleSettings }) {
  const series = usePingMiniSeries(uuid ?? "");
  const used = new Set<number>();
  const rows = CARRIERS.map((carrier) => {
    const match = series.find((item) => !used.has(item.taskId) && carrier.match.test(`${item.taskName} ${item.taskTarget}`));
    if (match) used.add(match.taskId);
    return { ...carrier, item: match };
  });
  const unassigned = series.filter((item) => !used.has(item.taskId));
  rows.forEach((row) => { if (!row.item) row.item = unassigned.shift(); });
  const latest = series.flatMap((item) => item.samples).reduce((max, sample) => Math.max(max, sample.time), 0);

  return (
    <section className="carrier-network-panel" aria-label="中国三大运营商网络质量">
      <header><div><RadioTower size={15} /><span><strong>中国三大运营商网络质量</strong><small>上海 → 当前节点 · 最近 1 小时</small></span></div><em>最后更新 {latest ? new Date(latest).toLocaleTimeString("zh-CN", { hour12: false }) : "等待数据"} · 实时刷新</em></header>
      <div className="carrier-network-columns"><span>线路</span><span>RT</span><span>丢包</span><span>延迟趋势</span><span>质量趋势</span></div>
      {rows.map((row) => <CarrierRow key={row.name} {...row} marqueeStyle={marqueeStyle} />)}
    </section>
  );
});
