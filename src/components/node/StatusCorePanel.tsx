import { memo, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Unplug,
} from "lucide-react";
import { clsx } from "clsx";
import type {
  CoreDashboardSettings,
  CoreShapeId,
} from "@/hooks/useVisualStyle";
import { formatBytes, type TrafficRateDisplay } from "@/utils/format";
import {
  clampFraction,
  getTrafficRadarLimit,
  scaleBoostedPercent,
  scalePercent,
} from "./dashboardHelpers";

interface StatusCorePanelProps {
  settings: CoreDashboardSettings;
  cpuPct: number;
  cpuCores: number;
  ramPct: number;
  ramUsed: number;
  ramTotal: number;
  diskPct: number;
  diskUsed: number;
  diskTotal: number;
  loadValue: number;
  loadFraction: number;
  upRate: TrafficRateDisplay;
  downRate: TrafficRateDisplay;
  latency: number | null;
  latencyMaxMs: number;
  loss: number | null;
  hasHomepagePingBinding: boolean;
  showPingMetrics: boolean;
}

interface CoreMetric {
  key: string;
  icon: ReactNode;
  label: string;
  valueText: string;
  unit?: string;
  detailText?: string;
  fraction: number;
  color: string;
  empty?: boolean;
}

const FIVE_BANDS = [0.9, 0.7, 0.5, 0.3, 0.1];
const SIX_BANDS = [0.92, 0.75, 0.58, 0.41, 0.24, 0.07];
const SEVEN_BANDS = [0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08];
const GRID_BANDS = [
  0.88, 0.92, 0.84,
  0.68, 0.72, 0.64,
  0.48, 0.52, 0.44,
  0.28, 0.32, 0.24,
  0.08, 0.12, 0.04,
];

function getCorePanelStyle(settings: CoreDashboardSettings) {
  return {
    "--core-cell-gap": `${scalePercent(settings.density, 6, 2).toFixed(1)}px`,
    "--core-shift": `${scalePercent(settings.fracture, 1.2, 7).toFixed(1)}px`,
    "--core-glow-opacity": scaleBoostedPercent(
      settings.glow,
      0.12,
      0.38,
      0.68,
    ).toFixed(3),
    "--core-glow-mix": `${Math.round(
      scaleBoostedPercent(settings.glow, 18, 42, 68),
    )}%`,
    "--core-glow-blur": `${scaleBoostedPercent(settings.glow, 5, 11, 18).toFixed(1)}px`,
    "--core-motion-ms": `${Math.round(
      scaleBoostedPercent(settings.motion, 5200, 2600, 1350),
    )}ms`,
  } as CSSProperties;
}

function getCoreTone(color: string, fraction: number) {
  const safeFraction = clampFraction(fraction);
  if (safeFraction <= 0.62) return color;
  const heat = Math.round(((safeFraction - 0.62) / 0.38) * 100);
  return `color-mix(in srgb, ${color} ${100 - heat}%, var(--status-error) ${heat}%)`;
}

function getEdgeThreshold(thresholds: number[], fraction: number) {
  const active = thresholds.filter((threshold) => fraction >= threshold);
  return active.length > 0 ? Math.max(...active) : null;
}

function getSegmentClass(
  baseClass: string,
  threshold: number,
  fraction: number,
  edgeThreshold: number | null,
) {
  return clsx(
    baseClass,
    fraction >= threshold && "is-lit",
    edgeThreshold === threshold && "is-edge",
  );
}

function StatusCoreVisual({
  shape,
  fraction,
}: {
  shape: CoreShapeId;
  fraction: number;
}) {
  const safeFraction = clampFraction(fraction);

  if (shape === "fiber") {
    const edge = getEdgeThreshold(FIVE_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-fiber" aria-hidden>
        {FIVE_BANDS.flatMap((threshold) => [
          <span
            key={`fiber-a-${threshold}`}
            className={getSegmentClass("status-core-fiber-segment", threshold, safeFraction, edge)}
          />,
          <span
            key={`fiber-b-${threshold}`}
            className={getSegmentClass(
              "status-core-fiber-segment is-offset",
              threshold,
              safeFraction,
              edge,
            )}
          />,
        ])}
      </div>
    );
  }

  if (shape === "grating") {
    const edge = getEdgeThreshold(SEVEN_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-grating" aria-hidden>
        {SEVEN_BANDS.map((threshold) => (
          <span
            key={`grating-${threshold}`}
            className={getSegmentClass("status-core-grating-bar", threshold, safeFraction, edge)}
          />
        ))}
      </div>
    );
  }

  if (shape === "wafer") {
    const edge = getEdgeThreshold(SIX_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-wafer" aria-hidden>
        {SIX_BANDS.map((threshold) => (
          <span
            key={`wafer-${threshold}`}
            className={getSegmentClass("status-core-wafer-slab", threshold, safeFraction, edge)}
          />
        ))}
      </div>
    );
  }

  if (shape === "beads") {
    const edge = getEdgeThreshold(SEVEN_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-beads" aria-hidden>
        {SEVEN_BANDS.map((threshold) => (
          <span
            key={`bead-${threshold}`}
            className={getSegmentClass("status-core-bead", threshold, safeFraction, edge)}
          />
        ))}
      </div>
    );
  }

  if (shape === "bridge") {
    const edge = getEdgeThreshold(FIVE_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-bridge" aria-hidden>
        <span className="status-core-bridge-tower">
          {FIVE_BANDS.map((threshold) => (
            <span
              key={`bridge-left-${threshold}`}
              className={getSegmentClass("status-core-tower-cell", threshold, safeFraction, edge)}
            />
          ))}
        </span>
        <span className="status-core-bridge-beam">
          <span
            className="status-core-beam-fill"
            style={{ height: `${safeFraction * 100}%` }}
          >
            <span className="status-core-beam-surface" />
          </span>
        </span>
        <span className="status-core-bridge-tower is-right">
          {FIVE_BANDS.map((threshold) => (
            <span
              key={`bridge-right-${threshold}`}
              className={getSegmentClass("status-core-tower-cell", threshold, safeFraction, edge)}
            />
          ))}
        </span>
      </div>
    );
  }

  if (shape === "fission") {
    const edge = getEdgeThreshold(FIVE_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-fission" aria-hidden>
        {FIVE_BANDS.map((threshold) => (
          <span
            key={`fission-${threshold}`}
            className={getSegmentClass("status-core-fission-drop", threshold, safeFraction, edge)}
          />
        ))}
      </div>
    );
  }

  if (shape === "broken-bridge") {
    const edge = getEdgeThreshold(FIVE_BANDS, safeFraction);
    return (
      <div className="status-core-visual is-broken-bridge" aria-hidden>
        {FIVE_BANDS.map((threshold) => (
          <span
            key={`broken-bridge-${threshold}`}
            className={getSegmentClass("status-core-bridge-row", threshold, safeFraction, edge)}
          >
            <span />
            <span />
          </span>
        ))}
      </div>
    );
  }

  const edge = getEdgeThreshold(GRID_BANDS, safeFraction);
  return (
    <div className="status-core-visual is-grid" aria-hidden>
      {GRID_BANDS.map((threshold, index) => (
        <span
          key={`grid-${index}-${threshold}`}
          className={getSegmentClass("status-core-grid-cell", threshold, safeFraction, edge)}
        />
      ))}
    </div>
  );
}

function StatusCoreGauge({
  shape,
  metric,
}: {
  shape: CoreShapeId;
  metric: CoreMetric;
}) {
  const fraction = clampFraction(metric.fraction);
  const visualFraction = metric.empty || fraction <= 0 ? 0 : Math.max(fraction, 0.1);
  const coreColor = getCoreTone(metric.color, fraction);
  const longValue = `${metric.valueText}${metric.unit ?? ""}`.length > 8;
  const pressure = fraction >= 0.9 ? "critical" : fraction >= 0.7 ? "high" : "normal";

  return (
    <div
      className="status-core-gauge"
      data-shape={shape}
      data-pressure={pressure}
      data-empty={metric.empty ? "true" : "false"}
      data-long-value={longValue ? "true" : "false"}
      style={{ "--core-color": coreColor } as CSSProperties}
      aria-label={`${metric.label} ${metric.valueText}${metric.unit ?? ""}`}
    >
      <div className="status-core-head">
        <span className="status-core-label">
          {metric.icon}
          <span>{metric.label}</span>
        </span>
        <span className="status-core-status-dot" aria-hidden />
      </div>
      <div className="status-core-body">
        <div className="status-core-readout">
          <strong className="status-core-value">
            <span>{metric.valueText}</span>
            {metric.unit && <small>{metric.unit}</small>}
          </strong>
          {metric.detailText && (
            <span className="status-core-detail" title={metric.detailText}>
              {metric.detailText}
            </span>
          )}
        </div>
        <StatusCoreVisual shape={shape} fraction={visualFraction} />
      </div>
    </div>
  );
}

export const StatusCorePanel = memo(function StatusCorePanel({
  settings,
  cpuPct,
  cpuCores,
  ramPct,
  ramUsed,
  ramTotal,
  diskPct,
  diskUsed,
  diskTotal,
  loadValue,
  loadFraction,
  upRate,
  downRate,
  latency,
  latencyMaxMs,
  loss,
  hasHomepagePingBinding,
  showPingMetrics,
}: StatusCorePanelProps) {
  const upLimit = getTrafficRadarLimit(upRate);
  const downLimit = getTrafficRadarLimit(downRate);
  const safeLatencyMax = Math.max(100, latencyMaxMs);
  const metrics: CoreMetric[] = [
    {
      key: "cpu",
      icon: <Cpu size={13} strokeWidth={2} />,
      label: "CPU",
      valueText: cpuPct.toFixed(0),
      unit: "%",
      detailText: `${cpuCores || 0} 核`,
      fraction: cpuPct / 100,
      color: "var(--ys-metric-cpu, var(--progress-cpu))",
    },
    {
      key: "memory",
      icon: <MemoryStick size={13} strokeWidth={2} />,
      label: "内存",
      valueText: ramPct.toFixed(0),
      unit: "%",
      detailText: `${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`,
      fraction: ramPct / 100,
      color: "var(--ys-metric-memory, var(--progress-memory))",
    },
    {
      key: "disk",
      icon: <HardDrive size={13} strokeWidth={2} />,
      label: "硬盘",
      valueText: diskPct.toFixed(0),
      unit: "%",
      detailText: `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`,
      fraction: diskPct / 100,
      color: "var(--ys-metric-disk, var(--progress-disk))",
    },
    {
      key: "load",
      icon: <Gauge size={13} strokeWidth={2} />,
      label: "负载",
      valueText: loadValue.toFixed(2),
      detailText: "1 分钟负载",
      fraction: loadFraction,
      color: "var(--ys-metric-load, var(--progress-cpu))",
    },
    {
      key: "up",
      icon: <ArrowUp size={13} strokeWidth={2.4} />,
      label: "上行",
      valueText: upRate.value,
      unit: upRate.unit,
      fraction: upRate.bitsPerSec / upLimit.bitsPerSec,
      color: "var(--ys-marquee-up, var(--progress-cpu))",
    },
    {
      key: "down",
      icon: <ArrowDown size={13} strokeWidth={2.4} />,
      label: "下行",
      valueText: downRate.value,
      unit: downRate.unit,
      fraction: downRate.bitsPerSec / downLimit.bitsPerSec,
      color: "var(--ys-marquee-down, var(--status-success))",
    },
  ];

  if (showPingMetrics) {
    metrics.push(
      {
        key: "latency",
        icon: <Clock3 size={13} strokeWidth={2} />,
        label: "延迟",
        valueText:
          latency != null ? String(Math.round(latency)) : hasHomepagePingBinding ? "—" : "未配",
        unit: latency != null ? "ms" : undefined,
        fraction: latency != null ? latency / safeLatencyMax : 0,
        color: "var(--ys-metric-latency, var(--status-online))",
        empty: latency == null,
      },
      {
        key: "loss",
        icon: <Unplug size={13} strokeWidth={2} />,
        label: "丢包",
        valueText:
          loss != null ? loss.toFixed(1) : hasHomepagePingBinding ? "—" : "未配",
        unit: loss != null ? "%" : undefined,
        fraction: loss != null ? loss / 100 : 0,
        color: "var(--ys-metric-loss, var(--status-offline))",
        empty: loss == null,
      },
    );
  }

  return (
    <div
      className="status-core-grid"
      data-core-shape={settings.shape}
      data-motion={settings.motion > 0 ? "on" : "off"}
      style={getCorePanelStyle(settings)}
      aria-label="状态核心信息展板"
    >
      {metrics.map((metric) => (
        <StatusCoreGauge key={metric.key} shape={settings.shape} metric={metric} />
      ))}
    </div>
  );
});
