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
  ipQualityApiUrl: string;
  staticRefreshInterval: number;
  thresholds: NetworkThresholds;
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
