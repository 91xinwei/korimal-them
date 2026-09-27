import {
  canonicalStaticIpAdapter,
  StaticIpEnvelopeSchema,
  type StaticIpAdapter,
} from "@/adapters/static-ip-adapter";
import type { ManagedStaticIpEntry, NetworkThresholds } from "@/config/network";
import type { StaticIpNode } from "@/types/network";

export interface StaticIpProvider {
  list(signal?: AbortSignal): Promise<StaticIpNode[]>;
}

type Fetcher = typeof fetch;

async function fetchNodes(
  url: string,
  thresholds: NetworkThresholds,
  signal: AbortSignal | undefined,
  fetcher: Fetcher,
  adapter: StaticIpAdapter,
) {
  const response = await fetcher(url, {
    method: "GET",
    credentials: url.startsWith("/") ? "include" : "omit",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Static IP request failed (${response.status})`);
  }
  const payload = StaticIpEnvelopeSchema.parse(await response.json());
  return adapter.adaptMany(payload.nodes, thresholds);
}

export class HttpStaticIpProvider implements StaticIpProvider {
  constructor(
    private readonly url: string,
    private readonly thresholds: NetworkThresholds,
    private readonly fetcher: Fetcher = fetch,
    private readonly adapter: StaticIpAdapter = canonicalStaticIpAdapter,
  ) {}

  list(signal?: AbortSignal) {
    return fetchNodes(this.url, this.thresholds, signal, this.fetcher, this.adapter);
  }
}

export class ThemeStaticIpProvider implements StaticIpProvider {
  constructor(
    private readonly entries: unknown[],
    private readonly thresholds: NetworkThresholds,
    private readonly adapter: StaticIpAdapter = canonicalStaticIpAdapter,
  ) {}

  async list(): Promise<StaticIpNode[]> {
    return this.adapter.adaptMany(this.entries, this.thresholds);
  }
}

export async function loadBundledStaticIpEntries(thresholds: NetworkThresholds): Promise<ManagedStaticIpEntry[]> {
  const nodes = await new HttpStaticIpProvider("/data/static-ips.json", thresholds).list();
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    country: node.country,
    countryCode: node.countryCode,
    city: node.city,
    ipv4: node.ipv4,
    isp: node.isp,
    provider: node.provider,
    planName: node.planName,
    asn: node.asn,
    ipCategory: node.ipCategory,
    bandwidth: node.bandwidth,
    monthlyPrice: node.monthlyPrice,
    currency: node.currency,
    subscriptionStartedAt: node.subscriptionStartedAt,
    subscriptionExpiresAt: node.subscriptionExpiresAt,
    billingCycleDays: node.billingCycleDays,
    autoRenew: node.autoRenew,
    nextChargeAt: node.nextChargeAt,
    nextBillingAmount: node.nextBillingAmount,
  }));
}

export class MockStaticIpProvider implements StaticIpProvider {
  constructor(
    private readonly thresholds: NetworkThresholds,
    private readonly fetcher: Fetcher = fetch,
    private readonly url = "/mock/static-ips.json",
  ) {}

  async list(signal?: AbortSignal) {
    const response = await this.fetcher(this.url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`Static IP mock request failed (${response.status})`);
    const payload = StaticIpEnvelopeSchema.parse(await response.json());
    const updatedAt = new Date().toISOString();
    return canonicalStaticIpAdapter.adaptMany(
      payload.nodes.map((node) =>
        node && typeof node === "object" ? { ...node, updatedAt } : node,
      ),
      this.thresholds,
    );
  }
}
