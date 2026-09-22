import type { NetworkThresholds } from "@/config/network";
import { deriveNodeStatus } from "@/config/network";
import type { NodeDisplay } from "@/types/komari";
import type { VpsNode } from "@/types/network";
import { getExpireDaysRemaining } from "@/utils/format";
import { getRegionCoordinates, getRegionDisplayName, resolveRegionCode } from "@/utils/region";

const BYTES_PER_MB = 1024 ** 2;
const BYTES_PER_GB = 1024 ** 3;

function positive(value: number | undefined | null) {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function monthlyPrice(price: number, billingCycle: string | number | null | undefined) {
  if (!Number.isFinite(price) || price < 0) return price === -1 ? 0 : undefined;
  if (price === 0) return undefined;
  const cycleDays = Number(billingCycle);
  if (!Number.isFinite(cycleDays) || cycleDays <= 0) return price;
  return price * (30 / cycleDays);
}

function trafficUsedBytes(node: NodeDisplay) {
  const up = Math.max(0, node.trafficUp || 0);
  const down = Math.max(0, node.trafficDown || 0);
  const type = node.traffic_limit_type.trim().toLowerCase();
  if (type === "up") return up;
  if (type === "down") return down;
  if (type === "max") return Math.max(up, down);
  if (type === "min") return Math.min(up, down);
  return up + down;
}

export function adaptKomariNode(
  node: NodeDisplay,
  network: { latency?: number | null; packetLoss?: number | null },
  thresholds: NetworkThresholds,
): VpsNode {
  const coordinate = getRegionCoordinates(node.region);
  const latency = positive(network.latency);
  const packetLoss = positive(network.packetLoss);
  const billingCycleDays = positive(Number(node.billing_cycle));
  const updatedAt = node.updatedAt > 0 ? new Date(node.updatedAt).toISOString() : undefined;
  const status = node.online === false || node.online == null
    ? "offline"
    : deriveNodeStatus({ latency, packetLoss, updatedAt, thresholds });

  return {
    id: node.uuid,
    name: node.name,
    type: "vps",
    country: getRegionDisplayName(node.region),
    countryCode: resolveRegionCode(node.region),
    latitude: coordinate?.latitude,
    longitude: coordinate?.longitude,
    provider: node.group || undefined,
    ipv4: node.ipv4 || undefined,
    ipv6: node.ipv6 || undefined,
    status,
    latency,
    packetLoss,
    updatedAt,
    monthlyPrice: monthlyPrice(node.price, node.billing_cycle),
    currency: node.currency || undefined,
    cpuPercent: positive(node.cpuPct),
    cpuCores: positive(node.cpu_cores),
    memoryUsedMB: positive(node.ramUsed / BYTES_PER_MB),
    memoryTotalMB: positive(node.ramTotal / BYTES_PER_MB),
    diskUsedGB: positive(node.diskUsed / BYTES_PER_GB),
    diskTotalGB: positive(node.diskTotal / BYTES_PER_GB),
    load: positive(node.load1),
    uploadSpeedKB: positive(node.netUp / 1024),
    downloadSpeedKB: positive(node.netDown / 1024),
    trafficOutGB: positive(node.trafficUp / BYTES_PER_GB),
    trafficInGB: positive(node.trafficDown / BYTES_PER_GB),
    trafficUsedGB: positive(trafficUsedBytes(node) / BYTES_PER_GB),
    trafficLimitGB: node.traffic_limit > 0 ? node.traffic_limit / BYTES_PER_GB : undefined,
    tcpConnections: positive(node.connectionsTcp),
    udpConnections: positive(node.connectionsUdp),
    uptimeDays: positive(node.uptime / 86_400),
    expireDays: getExpireDaysRemaining(node.expired_at) ?? undefined,
    billingCycleDays,
  };
}
