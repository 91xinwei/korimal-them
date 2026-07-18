import type { NodeDisplay, PingOverviewItem } from "@/types/komari";

export interface SnapshotRow {
  node: NodeDisplay;
  ping: PingOverviewItem;
}

function neutralizeSpreadsheetFormula(value: string) {
  const normalized = value.replace(/^[\uFEFF\u00A0\s]+/, "");
  return /^[=+\-@|]/.test(normalized) ? `'${value}` : value;
}

function escapeCsvCell(value: unknown) {
  const text = neutralizeSpreadsheetFormula(value == null ? "" : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename: string, content: string, type: string, bom = false) {
  const blob = new Blob([bom ? "\uFEFF" : "", content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getTrafficUsage(node: NodeDisplay) {
  const up = Math.max(0, node.trafficUp || 0);
  const down = Math.max(0, node.trafficDown || 0);
  const type = node.traffic_limit_type.trim().toLowerCase();
  if (type === "up") return up;
  if (type === "down") return down;
  if (type === "max") return Math.max(up, down);
  if (type === "min") return Math.min(up, down);
  return up + down;
}

function buildSnapshotNode({ node, ping }: SnapshotRow) {
  const trafficUsed = getTrafficUsage(node);
  return {
    uuid: node.uuid,
    name: node.name,
    online: node.online,
    group: node.group || "",
    region: node.region || "",
    tags: node.tags,
    remark: node.public_remark,
    system: {
      os: node.os,
      arch: node.arch,
      virtualization: node.virtualization,
      kernel: node.kernel_version,
    },
    hardware: {
      cpuName: node.cpu_name,
      cpuCores: node.cpu_cores,
      memoryTotal: node.mem_total,
      swapTotal: node.swap_total,
      diskTotal: node.disk_total,
      gpuName: node.gpu_name,
    },
    realtime: {
      cpuPercent: node.cpuPct,
      memoryUsed: node.ramUsed,
      memoryPercent: node.ramPct,
      swapUsed: node.swapUsed,
      swapPercent: node.swapPct,
      diskUsed: node.diskUsed,
      diskPercent: node.diskPct,
      load1: node.load1,
      load5: node.load5,
      load15: node.load15,
      uploadRate: node.netUp,
      downloadRate: node.netDown,
      trafficUp: node.trafficUp,
      trafficDown: node.trafficDown,
      uptime: node.uptime,
      processes: node.process,
      connectionsTcp: node.connectionsTcp,
      connectionsUdp: node.connectionsUdp,
      message: node.message,
      updatedAt: node.updatedAt,
    },
    trafficQuota: {
      used: trafficUsed,
      limit: node.traffic_limit,
      type: node.traffic_limit_type,
      percent: node.traffic_limit > 0 ? (trafficUsed / node.traffic_limit) * 100 : null,
    },
    ping: {
      assigned: ping.isAssigned,
      latest: ping.lastValue,
      max: ping.max,
      loss: ping.loss,
    },
    billing: {
      price: node.price,
      currency: node.currency,
      cycle: node.billing_cycle,
      autoRenewal: node.auto_renewal,
      expiredAt: node.expired_at,
    },
  };
}

export function exportSnapshotJson(rows: SnapshotRow[]) {
  const content = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      nodeCount: rows.length,
      nodes: rows.map(buildSnapshotNode),
    },
    null,
    2,
  );
  downloadText(`komari-YS-snapshot-${Date.now()}.json`, content, "application/json;charset=utf-8");
}

export function exportSnapshotCsv(rows: SnapshotRow[]) {
  const headers = [
    "节点 UUID", "名称", "状态", "分组", "地区", "系统", "架构", "CPU 核心",
    "CPU 占用", "内存占用", "硬盘占用", "负载", "上行速率", "下行速率",
    "累计上传", "累计下载", "流量限额", "流量使用率", "延迟", "丢包率",
    "运行时间", "到期时间", "价格", "币种", "标签", "备注", "探针消息",
  ];
  const body = rows.map(({ node, ping }) => {
    const trafficUsed = getTrafficUsage(node);
    const trafficPercent = node.traffic_limit > 0
      ? (trafficUsed / node.traffic_limit) * 100
      : "";
    return [
      node.uuid,
      node.name,
      node.online === true ? "在线" : node.online === false ? "离线" : "同步中",
      node.group || "",
      node.region || "",
      node.os,
      node.arch,
      node.cpu_cores,
      node.cpuPct,
      node.ramPct,
      node.diskPct,
      node.load1,
      node.netUp,
      node.netDown,
      node.trafficUp,
      node.trafficDown,
      node.traffic_limit,
      trafficPercent,
      ping.lastValue ?? "",
      ping.loss ?? "",
      node.uptime,
      node.expired_at || "",
      node.price,
      node.currency,
      node.tags,
      node.public_remark,
      node.message,
    ].map(escapeCsvCell).join(",");
  });
  downloadText(
    `komari-YS-snapshot-${Date.now()}.csv`,
    [headers.map(escapeCsvCell).join(","), ...body].join("\r\n"),
    "text/csv;charset=utf-8",
    true,
  );
}
