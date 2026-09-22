import { z } from "zod";
import type { NetworkThresholds } from "@/config/network";
import { deriveNodeStatus } from "@/config/network";
import type {
  StaticIpCategory,
  StaticIpNode,
  StaticIpProtocol,
  StaticIpUnlock,
} from "@/types/network";

export interface StaticIpAdapter<TRaw = unknown> {
  adapt(value: TRaw, thresholds: NetworkThresholds, now?: number): StaticIpNode | null;
  adaptMany(values: TRaw[], thresholds: NetworkThresholds, now?: number): StaticIpNode[];
}

const optionalText = z.union([z.string(), z.number()]).nullish();
const optionalNumber = z.union([z.number(), z.string()]).nullish();
const optionalBoolean = z.union([z.boolean(), z.number(), z.string()]).nullish();

const RawStaticIpNodeSchema = z
  .object({
    id: optionalText,
    name: optionalText,
    type: optionalText,
    country: optionalText,
    countryCode: optionalText,
    city: optionalText,
    latitude: optionalNumber,
    longitude: optionalNumber,
    provider: optionalText,
    ipv4: optionalText,
    ipv6: optionalText,
    isp: optionalText,
    asn: optionalText,
    ipCategory: optionalText,
    protocol: optionalText,
    status: optionalText,
    latency: optionalNumber,
    packetLoss: optionalNumber,
    availability: optionalNumber,
    riskScore: optionalNumber,
    proxyDetected: optionalBoolean,
    hostingDetected: optionalBoolean,
    vpnDetected: optionalBoolean,
    unlock: z.record(z.string(), z.unknown()).nullish(),
    monthlyPrice: optionalNumber,
    currency: optionalText,
    updatedAt: optionalText,
    subscriptionStartedAt: optionalText,
    subscriptionExpiresAt: optionalText,
    billingCycleDays: optionalNumber,
  })
  .strip();

export const StaticIpEnvelopeSchema = z.object({ nodes: z.array(z.unknown()).default([]) }).strip();

function text(value: unknown) {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function numberValue(value: unknown, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return undefined;
  return numeric;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return undefined;
}

function dateTimeValue(value: unknown) {
  const normalized = text(value);
  if (!normalized) return undefined;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function category(value: unknown): StaticIpCategory {
  const normalized = text(value)?.toLowerCase();
  if (
    normalized === "residential" ||
    normalized === "isp" ||
    normalized === "static-home" ||
    normalized === "datacenter"
  ) {
    return normalized;
  }
  return "unknown";
}

function protocol(value: unknown): StaticIpProtocol | undefined {
  const normalized = text(value)?.toLowerCase();
  return normalized === "http" || normalized === "https" || normalized === "socks5"
    ? normalized
    : undefined;
}

function unlock(value: Record<string, unknown> | null | undefined): StaticIpUnlock | undefined {
  if (!value) return undefined;
  const result: StaticIpUnlock = {
    chatgpt: booleanValue(value.chatgpt) ?? null,
    claude: booleanValue(value.claude) ?? null,
    google: booleanValue(value.google) ?? null,
    netflix: booleanValue(value.netflix) ?? null,
    disney: booleanValue(value.disney) ?? null,
    youtubePremium: booleanValue(value.youtubePremium) ?? null,
  };
  return result;
}

export function adaptStaticIpNode(
  value: unknown,
  thresholds: NetworkThresholds,
  now = Date.now(),
): StaticIpNode | null {
  const parsed = RawStaticIpNodeSchema.safeParse(value);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;

  const latency = numberValue(raw.latency, 0);
  const packetLoss = numberValue(raw.packetLoss, 0, 100);
  const riskScore = numberValue(raw.riskScore, 0, 100);
  const updatedAt = text(raw.updatedAt);

  return {
    id,
    name,
    type: "static",
    country: text(raw.country) ?? "Unknown",
    countryCode: text(raw.countryCode)?.toUpperCase(),
    city: text(raw.city),
    latitude: numberValue(raw.latitude, -90, 90),
    longitude: numberValue(raw.longitude, -180, 180),
    provider: text(raw.provider),
    ipv4: text(raw.ipv4),
    ipv6: text(raw.ipv6),
    status: deriveNodeStatus({
      declaredStatus: text(raw.status),
      latency,
      packetLoss,
      riskScore,
      updatedAt,
      thresholds,
      now,
    }),
    latency,
    packetLoss,
    updatedAt,
    monthlyPrice: numberValue(raw.monthlyPrice, 0),
    currency: text(raw.currency)?.toUpperCase(),
    isp: text(raw.isp),
    asn: text(raw.asn),
    ipCategory: category(raw.ipCategory),
    protocol: protocol(raw.protocol),
    availability: numberValue(raw.availability, 0, 100),
    riskScore,
    proxyDetected: booleanValue(raw.proxyDetected),
    hostingDetected: booleanValue(raw.hostingDetected),
    vpnDetected: booleanValue(raw.vpnDetected),
    unlock: unlock(raw.unlock),
    subscriptionStartedAt: dateTimeValue(raw.subscriptionStartedAt),
    subscriptionExpiresAt: dateTimeValue(raw.subscriptionExpiresAt),
    billingCycleDays: numberValue(raw.billingCycleDays, 1, 3650),
  };
}

export function adaptStaticIpNodes(
  values: unknown[],
  thresholds: NetworkThresholds,
  now = Date.now(),
) {
  return values
    .map((value) => adaptStaticIpNode(value, thresholds, now))
    .filter((node): node is StaticIpNode => node != null);
}

export const canonicalStaticIpAdapter: StaticIpAdapter = {
  adapt: adaptStaticIpNode,
  adaptMany: adaptStaticIpNodes,
};

export function maskIpAddress(value: string | undefined) {
  if (!value) return "--";
  const ipv4 = value.split(".");
  if (ipv4.length === 4 && ipv4.every((part) => /^\d{1,3}$/.test(part))) {
    return `${ipv4[0]}.${ipv4[1]}.xxx.xxx`;
  }

  if (value.includes(":")) {
    const segments = value.split(":");
    const visible = segments.slice(0, 3).join(":");
    return `${visible || "::"}:xxxx:xxxx`;
  }
  return "masked";
}
