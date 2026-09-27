import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SubscriptionPortfolio } from "@/pages/Subscriptions";
import type { NetworkAssetNode } from "@/types/network";

describe("SubscriptionPortfolio", () => {
  it("shows static residential IP and VPS expiry and billing without exposing masked IPs", () => {
    const assets: NetworkAssetNode[] = [
      {
        id: "home-1", name: "Comcast Home", type: "static", status: "online",
        country: "United States", ipv4: "48.45.163.45", isp: "Comcast",
        ipCategory: "residential", monthlyPrice: 4.31, currency: "USD",
        subscriptionExpiresAt: "2026-10-05T00:00:00Z", billingCycleDays: 30,
      },
      {
        id: "vps-1", name: "Tokyo VPS", type: "vps", status: "online",
        country: "Japan", monthlyPrice: 7, billingAmount: 14,
        currency: "USD", billingCycleDays: 60,
        subscriptionExpiresAt: "2026-10-12T00:00:00Z",
      },
    ];
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SubscriptionPortfolio assets={assets} maskStaticIp />
      </MemoryRouter>,
    );

    expect(markup).toContain("静态家庭 IP");
    expect(markup).toContain("VPS 订阅");
    expect(markup).toContain("Comcast Home");
    expect(markup).toContain("Tokyo VPS");
    expect(markup).toContain("2026-10-05");
    expect(markup).toContain("2026-10-12");
    expect(markup).toContain("USD 4.31");
    expect(markup).toContain("USD 14.00");
    expect(markup).toContain("USD 7.00");
    expect(markup).not.toContain("48.45.163.45");
  });
});
