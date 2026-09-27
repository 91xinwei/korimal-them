import type { NodeStatus } from "@/types/network";

export interface NetworkThresholds {
  latencyWarning: number;
  packetLossWarning: number;
  riskWarning: number;
  staleAfterSeconds: number;
}

export interface NetworkAssetSettings {
  showGlobalMap: boolean;
  showStaticIps: boolean;
  showRiskScore: boolean;
  showUnlockStatus: boolean;
  showMonthlyPrice: boolean;
  maskStaticIp: boolean;
  mapDefaultZoom: number;
  staticIpApiUrl: string;
  staticIpSource: "theme" | "url";
  staticIpNodes: ManagedStaticIpEntry[];
  ipQualityApiUrl: string;
  staticRefreshInterval: number;
  thresholds: NetworkThresholds;
}

export interface ManagedStaticIpEntry {
  id: string;
  name: string;
  country?: string;
  countryCode?: string;
  city?: string;
  ipv4?: string;
  isp?: string;
  provider?: string;
  planName?: string;
  asn?: string;
  ipCategory?: string;
  bandwidth?: string;
  monthlyPrice?: number;
  currency?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  billingCycleDays?: number;
  autoRenew?: boolean;
  nextChargeAt?: string;
  nextBillingAmount?: number;
}

export const DEFAULT_THRESHOLDS: NetworkThresholds = {
  latencyWarning: 250,
  packetLossWarning: 5,
  riskWarning: 50,
  staleAfterSeconds: 180,
};

export const DEFAULT_NETWORK_ASSET_SETTINGS: NetworkAssetSettings = {
  showGlobalMap: true,
  showStaticIps: true,
  showRiskScore: true,
  showUnlockStatus: true,
  showMonthlyPrice: true,
  maskStaticIp: true,
  mapDefaultZoom: 1.86,
  staticIpApiUrl: "/data/static-ips.json",
  staticIpSource: "url",
  staticIpNodes: [],
  ipQualityApiUrl: "/api/ip-quality",
  staticRefreshInterval: 60_000,
  thresholds: DEFAULT_THRESHOLDS,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function managedStaticIpEntries(value: unknown): ManagedStaticIpEntry[] {
  if (!Array.isArray(value)) return [];
  const strings = ["country", "countryCode", "city", "ipv4", "isp", "provider", "planName", "asn", "ipCategory", "bandwidth", "currency", "subscriptionStartedAt", "subscriptionExpiresAt", "nextChargeAt"] as const;
  const numbers = ["monthlyPrice", "billingCycleDays", "nextBillingAmount"] as const;
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const entry: ManagedStaticIpEntry = {
      id: String(record.id ?? "").trim().slice(0, 100),
      name: String(record.name ?? "").trim().slice(0, 200),
    };
    for (const key of strings) {
      if (typeof record[key] === "string" && record[key].trim()) entry[key] = record[key].trim().slice(0, 300);
    }
    for (const key of numbers) {
      const number = Number(record[key]);
      if (record[key] != null && record[key] !== "" && Number.isFinite(number) && number >= 0) entry[key] = number;
    }
    if (typeof record.autoRenew === "boolean") entry.autoRenew = record.autoRenew;
    return [entry];
  });
}

export function validateManagedStaticIpEntries(entries: ManagedStaticIpEntry[]): string | null {
  if (entries.length > 100) return "静态 IP 最多维护 100 条";
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (!entry.id.trim()) return `第 ${index + 1} 条静态 IP 缺少唯一 ID`;
    if (!entry.name.trim()) return `第 ${index + 1} 条静态 IP 缺少名称`;
    const id = entry.id.trim().toLowerCase();
    if (ids.has(id)) return `静态 IP ID 重复：${entry.id}`;
    ids.add(id);
    if (entry.ipv4 && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(entry.ipv4)) return `第 ${index + 1} 条 IPv4 格式不正确`;
    if (entry.ipv4 && entry.ipv4.split(".").some((part) => Number(part) > 255)) return `第 ${index + 1} 条 IPv4 格式不正确`;
    if (entry.monthlyPrice != null && !entry.currency) return `第 ${index + 1} 条月费缺少币种`;
    for (const field of ["subscriptionStartedAt", "subscriptionExpiresAt", "nextChargeAt"] as const) {
      if (entry[field] && !Number.isFinite(Date.parse(entry[field]))) return `第 ${index + 1} 条日期格式不正确`;
    }
  }
  return null;
}

export function normalizeStaticIpApiUrl(value: unknown, fallback = "/api/static-ips") {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (!candidate) return fallback;

  const containsCredentialQuery = (url: URL) =>
    [...url.searchParams.keys()].some((key) =>
      /(^|[-_])(api[-_]?key|token|secret|password|passwd|auth|signature)([-_]|$)/i.test(key),
    );

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    try {
      const parsed = new URL(candidate, "https://komari.invalid");
      return !parsed.hash && !containsCredentialQuery(parsed) ? candidate : fallback;
    } catch {
      return fallback;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash &&
      !containsCredentialQuery(parsed)
    ) {
      return parsed.toString();
    }
  } catch {
    // Invalid and credential-bearing URLs fall back to the safe same-origin endpoint.
  }
  return fallback;
}

export function normalizeNetworkAssetSettings(value: unknown): NetworkAssetSettings {
  const record = asRecord(value);
  const defaults = DEFAULT_NETWORK_ASSET_SETTINGS;
  const environmentUrl = import.meta.env.VITE_STATIC_IP_API_URL;
  const configuredUrl = environmentUrl || record.staticIpApiUrl;
  const configuredQualityUrl = import.meta.env.VITE_IP_QUALITY_API_URL || record.ipQualityApiUrl;

  return {
    showGlobalMap: booleanValue(record.showGlobalMap, defaults.showGlobalMap),
    showStaticIps: booleanValue(record.showStaticIps, defaults.showStaticIps),
    showRiskScore: booleanValue(record.showRiskScore, defaults.showRiskScore),
    showUnlockStatus: booleanValue(record.showUnlockStatus, defaults.showUnlockStatus),
    showMonthlyPrice: booleanValue(record.showMonthlyPrice, defaults.showMonthlyPrice),
    maskStaticIp: booleanValue(record.maskStaticIp, defaults.maskStaticIp),
    mapDefaultZoom: finiteNumber(record.mapDefaultZoom, defaults.mapDefaultZoom, 1.1, 4),
    staticIpApiUrl: normalizeStaticIpApiUrl(
      configuredUrl === "/api/static-ips" ? defaults.staticIpApiUrl : configuredUrl,
      defaults.staticIpApiUrl,
    ),
    staticIpSource: record.staticIpSource === "theme" ? "theme" : "url",
    staticIpNodes: managedStaticIpEntries(record.staticIpNodes),
    ipQualityApiUrl: normalizeStaticIpApiUrl(configuredQualityUrl, defaults.ipQualityApiUrl),
    staticRefreshInterval: finiteNumber(
      record.staticRefreshInterval,
      defaults.staticRefreshInterval,
      30_000,
      300_000,
    ),
    thresholds: {
      latencyWarning: finiteNumber(
        record.latencyWarningThreshold,
        defaults.thresholds.latencyWarning,
        1,
        10_000,
      ),
      packetLossWarning: finiteNumber(
        record.packetLossWarningThreshold,
        defaults.thresholds.packetLossWarning,
        0,
        100,
      ),
      riskWarning: finiteNumber(
        record.riskWarningThreshold,
        defaults.thresholds.riskWarning,
        0,
        100,
      ),
      staleAfterSeconds: finiteNumber(
        record.staticStaleAfterSeconds,
        defaults.thresholds.staleAfterSeconds,
        30,
        86_400,
      ),
    },
  };
}

export function serializeNetworkAssetSettings(settings: NetworkAssetSettings) {
  return {
    showGlobalMap: settings.showGlobalMap,
    showStaticIps: settings.showStaticIps,
    showRiskScore: settings.showRiskScore,
    showUnlockStatus: settings.showUnlockStatus,
    showMonthlyPrice: settings.showMonthlyPrice,
    maskStaticIp: settings.maskStaticIp,
    mapDefaultZoom: settings.mapDefaultZoom,
    staticIpApiUrl: normalizeStaticIpApiUrl(settings.staticIpApiUrl, DEFAULT_NETWORK_ASSET_SETTINGS.staticIpApiUrl),
    staticIpSource: settings.staticIpSource,
    staticIpNodes: managedStaticIpEntries(settings.staticIpNodes),
    ipQualityApiUrl: normalizeStaticIpApiUrl(settings.ipQualityApiUrl, "/api/ip-quality"),
    staticRefreshInterval: settings.staticRefreshInterval,
    latencyWarningThreshold: settings.thresholds.latencyWarning,
    packetLossWarningThreshold: settings.thresholds.packetLossWarning,
    riskWarningThreshold: settings.thresholds.riskWarning,
    staticStaleAfterSeconds: settings.thresholds.staleAfterSeconds,
  };
}

export function deriveNodeStatus({
  declaredStatus,
  latency,
  packetLoss,
  riskScore,
  updatedAt,
  thresholds,
  now = Date.now(),
}: {
  declaredStatus?: string;
  latency?: number;
  packetLoss?: number;
  riskScore?: number;
  updatedAt?: string | number;
  thresholds: NetworkThresholds;
  now?: number;
}): NodeStatus {
  const normalized = declaredStatus?.trim().toLowerCase();
  if (normalized === "offline") return "offline";

  const updatedTimestamp =
    typeof updatedAt === "number" ? updatedAt : updatedAt ? Date.parse(updatedAt) : Number.NaN;
  if (
    Number.isFinite(updatedTimestamp) &&
    now - updatedTimestamp > thresholds.staleAfterSeconds * 1000
  ) {
    return "offline";
  }

  if (
    normalized === "warning" ||
    (latency != null && latency > thresholds.latencyWarning) ||
    (packetLoss != null && packetLoss > thresholds.packetLossWarning) ||
    (riskScore != null && riskScore > thresholds.riskWarning)
  ) {
    return "warning";
  }
  return "online";
}
