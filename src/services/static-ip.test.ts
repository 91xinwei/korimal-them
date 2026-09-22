import { describe, expect, it, vi } from "vitest";
import { DEFAULT_THRESHOLDS } from "@/config/network";
import { HttpStaticIpProvider } from "@/services/static-ip";

describe("HttpStaticIpProvider", () => {
  it("converts the envelope through the adapter", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      nodes: [{ id: "static-1", name: "Home IP", country: "US" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const provider = new HttpStaticIpProvider("/api/static-ips", DEFAULT_THRESHOLDS, fetcher as typeof fetch);
    await expect(provider.list()).resolves.toMatchObject([
      { id: "static-1", name: "Home IP", type: "static", country: "US" },
    ]);
    expect(fetcher).toHaveBeenCalledWith("/api/static-ips", expect.objectContaining({
      credentials: "include",
      method: "GET",
    }));
  });

  it("fails closed on HTTP and malformed envelope errors", async () => {
    const failed = new HttpStaticIpProvider(
      "/api/static-ips",
      DEFAULT_THRESHOLDS,
      vi.fn(async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch,
    );
    await expect(failed.list()).rejects.toThrow("Static IP request failed (502)");

    const malformed = new HttpStaticIpProvider(
      "/api/static-ips",
      DEFAULT_THRESHOLDS,
      vi.fn(async () => new Response(JSON.stringify({ nodes: "not-an-array" }), { status: 200 })) as unknown as typeof fetch,
    );
    await expect(malformed.list()).rejects.toThrow();
  });
});
