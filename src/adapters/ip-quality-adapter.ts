import type { IpQualityProvider, StaticIpQuality } from "@/types/network";

type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
const num = (value: unknown) => {
  const parsed = value === "" || value == null ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : undefined;
};
const bool = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return undefined;
};
const str = (value: unknown) => value == null ? undefined : String(value).trim() || undefined;
const iso = (value: unknown) => {
  const valueString = str(value);
  const timestamp = valueString ? Date.parse(valueString) : NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};
const first = <T>(...values: (T | undefined)[]) => values.find((value) => value !== undefined);

export interface IpQualityInput {
  quality?: unknown;
  ipqs?: unknown;
  ipinfo?: unknown;
  abuseipdb?: unknown;
  proxycheck?: unknown;
  maxmind?: unknown;
  qualityScore?: unknown;
  riskScore?: unknown;
  latency?: unknown;
  packetLoss?: unknown;
  availability?: unknown;
  proxyDetected?: unknown;
  hostingDetected?: unknown;
  vpnDetected?: unknown;
}

export function adaptIpQuality(input: IpQualityInput): StaticIpQuality | undefined {
  const canonical = asRecord(input.quality);
  const ipqs = asRecord(input.ipqs) ?? asRecord(canonical?.ipqs);
  const ipinfo = asRecord(input.ipinfo) ?? asRecord(canonical?.ipinfo);
  const privacy = asRecord(ipinfo?.privacy);
  const abuseEnvelope = asRecord(input.abuseipdb) ?? asRecord(canonical?.abuseipdb);
  const abuse = asRecord(abuseEnvelope?.data) ?? abuseEnvelope;
  const maxmind = asRecord(input.maxmind) ?? asRecord(canonical?.maxmind);
  const proxycheck = asRecord(input.proxycheck) ?? asRecord(canonical?.proxycheck);
  const maxmindTraits = asRecord(maxmind?.traits);

  const sources: IpQualityProvider[] = [];
  if (ipqs) sources.push("ipqs");
  if (ipinfo) sources.push("ipinfo");
  if (abuse) sources.push("abuseipdb");
  if (maxmind) sources.push("maxmind");
  if (proxycheck) sources.push("proxycheck");

  const fraudScore = first(num(canonical?.fraudScore), num(ipqs?.fraud_score), num(ipqs?.fraudScore));
  const abuseConfidenceScore = first(
    num(canonical?.abuseConfidenceScore),
    num(abuse?.abuseConfidenceScore),
  );
  const maxmindRisk = first(num(maxmind?.ipRiskScore), num(maxmind?.risk), num(maxmindTraits?.ip_risk));
  const proxycheckRisk = num(proxycheck?.risk);
  const explicitRisk = first(num(canonical?.reputationRiskScore), num(input.riskScore));
  const reputationRiskScore = first(
    explicitRisk,
    [fraudScore, abuseConfidenceScore, maxmindRisk, proxycheckRisk].filter((value): value is number => value != null).length
      ? Math.max(...[fraudScore, abuseConfidenceScore, maxmindRisk, proxycheckRisk].filter((value): value is number => value != null))
      : undefined,
  );

  const latency = num(input.latency);
  const packetLoss = num(input.packetLoss);
  const availability = num(input.availability);
  const explicitQuality = first(num(canonical?.score), num(canonical?.qualityScore), num(input.qualityScore));
  const parts: { value: number; weight: number }[] = [];
  if (reputationRiskScore != null) parts.push({ value: 100 - reputationRiskScore, weight: 45 });
  if (latency != null) parts.push({ value: Math.max(0, 100 - latency / 4), weight: 20 });
  if (packetLoss != null) parts.push({ value: Math.max(0, 100 - packetLoss * 10), weight: 20 });
  if (availability != null) parts.push({ value: availability, weight: 15 });
  const hasNetworkMeasurement = latency != null || packetLoss != null || availability != null;
  const derivedScore = hasNetworkMeasurement && parts.length
    ? Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) /
      parts.reduce((sum, part) => sum + part.weight, 0))
    : undefined;
  const score = explicitQuality ?? derivedScore;

  const providerName = str(canonical?.provider)?.toLowerCase() as IpQualityProvider | undefined;
  const provider: IpQualityProvider = sources.length > 1
    ? "composite"
    : sources[0] ?? (providerName && ["ipqs", "ipinfo", "abuseipdb", "maxmind", "proxycheck", "composite", "local"].includes(providerName)
      ? providerName : "local");

  if (score == null && reputationRiskScore == null && sources.length === 0 && !canonical) return undefined;
  return {
    score,
    reputationRiskScore,
    fraudScore,
    abuseConfidenceScore,
    provider,
    sources: sources.length ? sources : [provider],
    checkedAt: first(iso(canonical?.checkedAt), iso(proxycheck?.checkedAt), iso(ipqs?.request_date), iso(abuse?.lastReportedAt)),
    stale: bool(canonical?.stale),
    proxyDetected: first(bool(canonical?.proxyDetected), bool(ipqs?.proxy), bool(privacy?.proxy), bool(proxycheck?.proxy), bool(input.proxyDetected)),
    hostingDetected: first(bool(canonical?.hostingDetected), bool(ipqs?.is_crawler), bool(privacy?.hosting), bool(maxmindTraits?.is_hosting_provider), bool(input.hostingDetected)),
    vpnDetected: first(bool(canonical?.vpnDetected), bool(ipqs?.vpn), bool(privacy?.vpn), bool(maxmindTraits?.is_anonymous_vpn), bool(proxycheck?.vpn), bool(input.vpnDetected)),
    torDetected: first(bool(canonical?.torDetected), bool(ipqs?.tor), bool(privacy?.tor), bool(maxmindTraits?.is_tor_exit_node)),
    residentialProxyDetected: first(bool(canonical?.residentialProxyDetected), bool(privacy?.residential), bool(maxmindTraits?.is_residential_proxy)),
    botDetected: first(bool(canonical?.botDetected), bool(ipqs?.bot_status)),
    recentAbuse: first(bool(canonical?.recentAbuse), bool(ipqs?.recent_abuse)),
    abuseVelocity: first(str(canonical?.abuseVelocity), str(ipqs?.abuse_velocity)),
    connectionType: first(str(canonical?.connectionType), str(ipqs?.connection_type), str(proxycheck?.type)),
  };
}

export function ipQualityGrade(score: number | undefined) {
  if (score == null) return { label: "Unknown", tone: "unknown" } as const;
  if (score >= 85) return { label: "Excellent", tone: "excellent" } as const;
  if (score >= 70) return { label: "Good", tone: "good" } as const;
  if (score >= 50) return { label: "Fair", tone: "fair" } as const;
  return { label: "Poor", tone: "poor" } as const;
}
