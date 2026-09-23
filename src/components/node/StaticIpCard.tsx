import { memo } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Clock3,
  CloudCog,
  Fingerprint,
  Gauge,
  Globe2,
  MapPin,
  Network,
  Radar,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { maskIpAddress } from "@/adapters/static-ip-adapter";
import { ipQualityGrade } from "@/adapters/ip-quality-adapter";
import type { NetworkAssetSettings } from "@/config/network";
import type { StaticIpNode } from "@/types/network";
import { Flag } from "@/components/ui/Flag";

const CATEGORY_LABELS = {
  residential: "Residential",
  isp: "ISP",
  "static-home": "Static Home",
  datacenter: "Datacenter",
  unknown: "Unknown",
} as const;

function booleanLabel(value: boolean | undefined) {
  if (value == null) return "--";
  return value ? "Yes" : "No";
}

function relativeTime(value: string | undefined) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function price(node: StaticIpNode) {
  if (node.monthlyPrice == null || !node.currency) return "--";
  try {
    return `${new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: node.currency,
      maximumFractionDigits: 2,
    }).format(node.monthlyPrice)} / month`;
  } catch {
    return `${node.currency} ${node.monthlyPrice} / month`;
  }
}

function dateLabel(value: string | undefined) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function expiryLabel(value: string | undefined) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  const days = Math.ceil((timestamp - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="static-ip-field">
      <span className="static-ip-field-icon">{icon}</span>
      <span><small>{label}</small><strong>{value || "--"}</strong></span>
    </div>
  );
}

export const StaticIpCard = memo(function StaticIpCard({
  node,
  settings,
}: {
  node: StaticIpNode;
  settings: NetworkAssetSettings;
}) {
  const displayIpv4 = settings.maskStaticIp ? maskIpAddress(node.ipv4) : (node.ipv4 ?? "--");
  const displayIpv6 = settings.maskStaticIp ? maskIpAddress(node.ipv6) : (node.ipv6 ?? "--");
  const unlockEntries = Object.entries(node.unlock ?? {});
  const grade = ipQualityGrade(node.quality?.score);
  const qualitySources = node.quality?.sources.map((source) => source.toUpperCase()).join(" + ");

  return (
    <article className="server-card static-ip-card" data-status={node.status}>
      <div className="server-card-content">
        <header className="server-card-header static-ip-header">
          <div className="server-card-title-block">
            <div className="server-card-title-row">
              <Flag region={node.countryCode ?? node.country} size={17} />
              <span className="server-card-title-link">{node.name}</span>
              <span className="network-status-dot" data-status={node.status} title={node.status} />
            </div>
            <div className="static-ip-badges">
              <span data-kind="static">STATIC</span>
              <span>{CATEGORY_LABELS[node.ipCategory ?? "unknown"]}</span>
              {node.protocol && <span>{node.protocol.toUpperCase()}</span>}
            </div>
          </div>
        </header>

        {settings.showRiskScore && (
          <div className="static-ip-quality" data-tone={grade.tone}>
            <div className="static-ip-quality-ring" style={{ "--quality": node.quality?.score ?? 0 } as React.CSSProperties}>
              <strong>{node.quality?.score ?? "--"}</strong><small>/100</small>
            </div>
            <div className="static-ip-quality-copy">
              <span><Sparkles size={12} /> IP Quality</span>
              <strong>{node.quality?.score == null ? "待检测" : grade.label}</strong>
              <small>{qualitySources || "等待评分服务"}{node.quality?.stale ? " · stale" : ""}</small>
            </div>
            <div className="static-ip-quality-risk">
              <small>REPUTATION RISK</small>
              <strong>{node.quality?.reputationRiskScore ?? "--"}</strong>
              <span>higher is riskier</span>
            </div>
          </div>
        )}

        <div className="static-ip-section static-ip-identity-grid">
          <Field icon={<Globe2 size={14} />} label="IPv4" value={displayIpv4} />
          {node.ipv6 && <Field icon={<Network size={14} />} label="IPv6" value={displayIpv6} />}
          <Field icon={<CloudCog size={14} />} label="ISP" value={node.isp} />
          <Field icon={<Fingerprint size={14} />} label="ASN" value={node.asn} />
          <Field icon={<BadgeCheck size={14} />} label="Provider" value={node.provider} />
          {node.planName && <Field icon={<BadgeCheck size={14} />} label="Plan" value={node.planName} />}
          <Field
            icon={<MapPin size={14} />}
            label="Location"
            value={[node.city, node.country].filter(Boolean).join(", ")}
          />
        </div>

        <div className="static-ip-section static-ip-metric-grid">
          <Field icon={<Gauge size={14} />} label="Latency" value={node.latency != null ? `${node.latency} ms` : "--"} />
          <Field icon={<Radar size={14} />} label="Packet Loss" value={node.packetLoss != null ? `${node.packetLoss}%` : "--"} />
          <Field icon={<Activity size={14} />} label="Availability" value={node.availability != null ? `${node.availability}%` : "--"} />
          {settings.showRiskScore && (
            <Field icon={<ShieldQuestion size={14} />} label="Risk" value={node.riskScore != null ? `${node.riskScore} / 100` : "--"} />
          )}
        </div>

        <div className="static-ip-section static-ip-detection-grid">
          <Field icon={<ShieldCheck size={14} />} label="Proxy" value={booleanLabel(node.proxyDetected)} />
          <Field icon={<ShieldCheck size={14} />} label="Hosting" value={booleanLabel(node.hostingDetected)} />
          <Field icon={<ShieldCheck size={14} />} label="VPN" value={booleanLabel(node.vpnDetected)} />
          <Field icon={<ShieldCheck size={14} />} label="Tor" value={booleanLabel(node.quality?.torDetected)} />
          <Field icon={<ShieldCheck size={14} />} label="Residential Proxy" value={booleanLabel(node.quality?.residentialProxyDetected)} />
          <Field icon={<ShieldCheck size={14} />} label="Recent Abuse" value={booleanLabel(node.quality?.recentAbuse)} />
        </div>

        {settings.showUnlockStatus && unlockEntries.length > 0 && (
          <div className="static-ip-section static-ip-unlock" aria-label="Unlock status">
            {unlockEntries.map(([service, available]) => (
              <span key={service} data-available={available === true ? "true" : available === false ? "false" : "unknown"}>
                <small>{service === "youtubePremium" ? "YouTube Premium" : service}</small>
                <strong>{available === true ? "OK" : available === false ? "No" : "--"}</strong>
              </span>
            ))}
          </div>
        )}

        {(node.subscriptionStartedAt || node.subscriptionExpiresAt || node.billingCycleDays) && (
          <div className="static-ip-section static-ip-subscription-grid" aria-label="Subscription">
            <Field
              icon={<CalendarDays size={14} />}
              label="Subscribed"
              value={dateLabel(node.subscriptionStartedAt)}
            />
            <Field
              icon={<CalendarDays size={14} />}
              label="Expires"
              value={expiryLabel(node.subscriptionExpiresAt)}
            />
            {node.billingCycleDays != null && (
              <Field
                icon={<RefreshCw size={14} />}
                label="Billing Cycle"
                value={`${node.billingCycleDays} days`}
              />
            )}
            {node.nextChargeAt && (
              <Field
                icon={<CalendarDays size={14} />}
                label={node.autoRenew ? "Next Auto-renew" : "Next Charge"}
                value={dateLabel(node.nextChargeAt)}
              />
            )}
            {node.nextBillingAmount != null && (
              <Field
                icon={<WalletCards size={14} />}
                label="Next Billing"
                value={`${node.currency ?? "USD"} ${node.nextBillingAmount.toFixed(2)}`}
              />
            )}
            {node.bandwidth && (
              <Field icon={<Network size={14} />} label="Bandwidth" value={node.bandwidth} />
            )}
          </div>
        )}

        <footer className="server-card-footer static-ip-footer">
          <Field icon={<Clock3 size={14} />} label="Last Check" value={relativeTime(node.updatedAt)} />
          {node.quality?.checkedAt && (
            <Field icon={<ShieldCheck size={14} />} label="Reputation Check" value={relativeTime(node.quality.checkedAt)} />
          )}
          {settings.showMonthlyPrice && (
            <Field icon={<WalletCards size={14} />} label="Price" value={price(node)} />
          )}
        </footer>
      </div>
    </article>
  );
});
