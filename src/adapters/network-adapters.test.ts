import { describe, expect, it } from "vitest";
import { adaptKomariNode } from "@/adapters/komari-node-adapter";
import { adaptStaticIpNode, adaptStaticIpNodes, maskIpAddress } from "@/adapters/static-ip-adapter";
import { DEFAULT_THRESHOLDS, deriveNodeStatus, normalizeStaticIpApiUrl } from "@/config/network";
import type { NodeDisplay } from "@/types/komari";

describe("StaticIpAdapter", () => {
  it("normalizes a vendor-neutral record and strips unknown fields", () => {
    const node = adaptStaticIpNode({
      id: 42,
      name: "London Home",
      country: "United Kingdom",
      countryCode: "gb",
      latitude: "51.5072",
      longitude: "-0.1276",
      ipCategory: "RESIDENTIAL",
      protocol: "SOCKS5",
      latency: "31",
      packetLoss: "0.5",
      riskScore: 12,
      proxyDetected: "false",
      unlock: { netflix: true, unexpected: "secret-shaped-noise" },
      subscriptionStartedAt: "2026-09-01T00:00:00Z",
      subscriptionExpiresAt: "2026-10-01T00:00:00Z",
      billingCycleDays: "30",
      ignoredVendorCredential: "must-not-survive",
    }, DEFAULT_THRESHOLDS, Date.parse("2026-09-20T00:00:00Z"));

    expect(node).toMatchObject({
      id: "42",
      name: "London Home",
      type: "static",
      countryCode: "GB",
      ipCategory: "residential",
      protocol: "socks5",
      latency: 31,
      packetLoss: 0.5,
      proxyDetected: false,
      status: "online",
      subscriptionStartedAt: "2026-09-01T00:00:00.000Z",
      subscriptionExpiresAt: "2026-10-01T00:00:00.000Z",
      billingCycleDays: 30,
    });
    expect(node).not.toHaveProperty("ignoredVendorCredential");
    expect(node?.unlock).toEqual({
      chatgpt: null,
      claude: null,
      google: null,
      netflix: true,
      disney: null,
      youtubePremium: null,
    });
  });

  it("rejects missing identity and tolerates malformed optional fields", () => {
    expect(adaptStaticIpNode({ name: "No id" }, DEFAULT_THRESHOLDS)).toBeNull();
    const nodes = adaptStaticIpNodes([
      { id: "valid", name: "Valid", latitude: 200, packetLoss: 500 },
      null,
      "bad",
    ], DEFAULT_THRESHOLDS);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].latitude).toBeUndefined();
    expect(nodes[0].packetLoss).toBeUndefined();
  });

  it("masks IPv4 and IPv6 without exposing the address tail", () => {
    expect(maskIpAddress("203.0.113.42")).toBe("203.0.xxx.xxx");
    expect(maskIpAddress("2001:db8:abcd:12::1")).toBe("2001:db8:abcd:xxxx:xxxx");
  });

  it("normalizes a 200-node payload without losing map identities", () => {
    const payload = Array.from({ length: 200 }, (_, index) => ({
      id: `static-${index}`,
      name: `Static ${index}`,
      country: "US",
      countryCode: "US",
      latitude: 25 + (index % 40),
      longitude: -125 + (index % 60),
      status: "online",
    }));
    const nodes = adaptStaticIpNodes(payload, DEFAULT_THRESHOLDS);
    expect(nodes).toHaveLength(200);
    expect(new Set(nodes.map((node) => node.id)).size).toBe(200);
  });
});

describe("network status", () => {
  it("refuses credential-bearing public data-source URLs", () => {
    expect(normalizeStaticIpApiUrl("https://user:pass@example.com/nodes")).toBe("/api/static-ips");
    expect(normalizeStaticIpApiUrl("/api/static-ips?api_key=secret")).toBe("/api/static-ips");
    expect(normalizeStaticIpApiUrl("https://example.com/nodes?token=secret")).toBe("/api/static-ips");
    expect(normalizeStaticIpApiUrl("https://example.com/nodes?region=uk")).toBe("https://example.com/nodes?region=uk");
  });

  it("prioritizes offline and derives warning thresholds", () => {
    expect(deriveNodeStatus({ declaredStatus: "offline", latency: 999, thresholds: DEFAULT_THRESHOLDS })).toBe("offline");
    expect(deriveNodeStatus({ latency: 251, thresholds: DEFAULT_THRESHOLDS })).toBe("warning");
    expect(deriveNodeStatus({ packetLoss: 5, thresholds: DEFAULT_THRESHOLDS })).toBe("online");
    expect(deriveNodeStatus({ packetLoss: 5.1, thresholds: DEFAULT_THRESHOLDS })).toBe("warning");
  });

  it("marks stale static measurements offline", () => {
    const now = Date.parse("2026-09-20T12:00:00Z");
    expect(deriveNodeStatus({
      updatedAt: "2026-09-20T11:56:59Z",
      thresholds: DEFAULT_THRESHOLDS,
      now,
    })).toBe("offline");
  });
});

describe("KomariAdapter", () => {
  it("maps the existing Komari display model without changing its source", () => {
    const display = {
      uuid: "vps-1",
      name: "Tokyo VPS",
      group: "Production",
      region: "JP",
      ipv4: "192.0.2.1",
      ipv6: "2001:db8::1",
      price: 14,
      billing_cycle: "30",
      currency: "USD",
      online: true,
      cpuPct: 35,
      cpu_cores: 4,
      ramUsed: 1024 ** 3,
      ramTotal: 2 * 1024 ** 3,
      diskUsed: 10 * 1024 ** 3,
      diskTotal: 40 * 1024 ** 3,
      netUp: 2048,
      netDown: 4096,
      trafficUp: 3 * 1024 ** 3,
      trafficDown: 7 * 1024 ** 3,
      traffic_limit: 100 * 1024 ** 3,
      traffic_limit_type: "sum",
      connectionsTcp: 42,
      connectionsUdp: 2,
      uptime: 864_000,
      load1: 0.9,
      updatedAt: Date.now(),
      expired_at: "",
    } as NodeDisplay;

    const node = adaptKomariNode(display, { latency: 41, packetLoss: 0 }, DEFAULT_THRESHOLDS);
    expect(node).toMatchObject({
      id: "vps-1",
      type: "vps",
      status: "online",
      monthlyPrice: 14,
      memoryUsedMB: 1024,
      diskUsedGB: 10,
      trafficUsedGB: 10,
      tcpConnections: 42,
      udpConnections: 2,
      uptimeDays: 10,
    });
  });
});
