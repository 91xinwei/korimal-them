import { z } from "zod";
import { adaptIpQuality } from "@/adapters/ip-quality-adapter";
import type { StaticIpQuality } from "@/types/network";

const EnvelopeSchema = z.object({ nodes: z.array(z.unknown()).default([]) }).strip();

export interface VpsIpQualityRecord {
  id: string;
  quality: StaticIpQuality;
}

export async function fetchIpQualityRecords(
  url: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    credentials: url.startsWith("/") ? "include" : "omit",
    signal,
  });
  if (!response.ok) throw new Error(`IP quality request failed (${response.status})`);
  const payload = EnvelopeSchema.parse(await response.json());
  return payload.nodes.flatMap((value): VpsIpQualityRecord[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const id = String(record.id ?? record.nodeId ?? "").trim();
    const quality = adaptIpQuality({
      quality: record.quality ?? record,
      ipqs: record.ipqs,
      ipinfo: record.ipinfo,
      abuseipdb: record.abuseipdb,
      proxycheck: record.proxycheck,
      maxmind: record.maxmind,
      qualityScore: record.qualityScore,
      riskScore: record.riskScore,
    });
    return id && quality ? [{ id, quality }] : [];
  });
}
