import {
  canonicalStaticIpAdapter,
  StaticIpEnvelopeSchema,
  type StaticIpAdapter,
} from "@/adapters/static-ip-adapter";
import type { NetworkThresholds } from "@/config/network";
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
