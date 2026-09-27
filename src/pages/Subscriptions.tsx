import { CalendarDays, ChevronLeft, CircleDollarSign, Globe2, Server, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { maskIpAddress } from "@/adapters/static-ip-adapter";
import { useNetworkAssets } from "@/hooks/useNetworkAssets";
import { useNetworkSettings } from "@/hooks/useNetworkSettings";
import { useVisibleNodes } from "@/hooks/useNode";
import type { NetworkAssetNode, StaticIpNode, VpsNode } from "@/types/network";

function dateLabel(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
}

function money(value: number | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return "未设置";
  const code = currency?.toUpperCase();
  try {
    const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return code ? `${code} ${amount}` : `${amount}（币种未设置）`;
  } catch {
    return code ? `${code} ${value.toFixed(2)}` : `${value.toFixed(2)}（币种未设置）`;
  }
}

function expiryState(value: string | undefined) {
  if (!value) return { text: "未设置到期日", tone: "unknown" };
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { text: "未设置到期日", tone: "unknown" };
  const days = Math.ceil((timestamp - Date.now()) / 86_400_000);
  if (days < 0) return { text: `已过期 ${Math.abs(days)} 天`, tone: "expired" };
  if (days <= 30) return { text: `${days} 天后到期`, tone: "soon" };
  return { text: `${days} 天后到期`, tone: "normal" };
}

function SubscriptionCard({ node, maskStaticIp }: { node: NetworkAssetNode; maskStaticIp: boolean }) {
  const staticNode = node.type === "static" ? node as StaticIpNode : null;
  const vpsNode = node.type === "vps" ? node as VpsNode : null;
  const expiresAt = staticNode?.subscriptionExpiresAt ?? vpsNode?.subscriptionExpiresAt;
  const startDate = dateLabel(staticNode?.subscriptionStartedAt);
  const renewalDate = dateLabel(expiresAt);
  const billingCycleDays = staticNode?.billingCycleDays ?? vpsNode?.billingCycleDays;
  const expiry = expiryState(expiresAt);
  const location = [node.city, node.country].filter(Boolean).join(" · ") || "地区未设置";
  const address = staticNode?.ipv4
    ? (maskStaticIp ? maskIpAddress(staticNode.ipv4) : staticNode.ipv4)
    : undefined;

  return (
    <article className="subscription-card" data-type={node.type}>
      <div className="subscription-card-top">
        <div className="subscription-card-icon">{staticNode ? <Globe2 size={22} /> : <Server size={22} />}</div>
        <div className="subscription-card-identity">
          <span>{staticNode ? "STATIC RESIDENTIAL IP" : "KOMARI VPS"}</span>
          <h3>{node.name}</h3>
          <p>{staticNode?.isp || node.provider || location}</p>
        </div>
        {renewalDate && <span className="subscription-expiry-state" data-tone={expiry.tone}>{expiry.text}</span>}
      </div>

      <div className="subscription-card-location">
        <span>{location}</span>
        {address && <code>{address}</code>}
        {staticNode?.asn && <span>{staticNode.asn}</span>}
      </div>

      <div className="subscription-card-metrics">
        {startDate && <div><span>订阅开始</span><strong>{startDate}</strong></div>}
        {renewalDate && <div><span>{staticNode ? "续费时间" : "到期时间"}</span><strong>{renewalDate}</strong></div>}
        {billingCycleDays != null && <div><span>计费周期</span><strong>{billingCycleDays} 天</strong></div>}
      </div>

      <div className="subscription-card-billing">
        {node.monthlyPrice != null && Number.isFinite(node.monthlyPrice) && <div>
          <span><CircleDollarSign size={15} /> 折算月费</span>
          <strong>{money(node.monthlyPrice, node.currency)}<small>/月</small></strong>
        </div>}
        {vpsNode?.billingAmount != null && <div>
          <span><CalendarDays size={15} /> 本周期金额</span>
          <strong>{money(vpsNode.billingAmount, node.currency)}</strong>
        </div>}
        {staticNode?.nextBillingAmount != null && (
          <div><span>下次扣费金额</span><strong>{money(staticNode.nextBillingAmount, node.currency)}</strong></div>
        )}
      </div>

      <div className="subscription-card-foot">
        {staticNode ? staticNode.autoRenew != null && <span><ShieldCheck size={14} /> {staticNode.autoRenew ? "自动续费" : "手动续费"}</span> : <span><ShieldCheck size={14} /> 订阅信息来自 Komari 节点</span>}
        {vpsNode && <Link to={`/instance/${encodeURIComponent(node.id)}`}>查看节点 →</Link>}
      </div>
    </article>
  );
}

export function SubscriptionPortfolio({
  assets,
  maskStaticIp,
  staticLoading = false,
  staticError = null,
}: {
  assets: NetworkAssetNode[];
  maskStaticIp: boolean;
  staticLoading?: boolean;
  staticError?: Error | null;
}) {
  const staticNodes = assets.filter((node): node is StaticIpNode => node.type === "static");
  const vpsNodes = assets.filter((node): node is VpsNode => node.type === "vps");
  const sections = [
    { id: "static", title: "静态家庭 IP", detail: "独立订阅 · ISP / Residential", nodes: staticNodes },
    { id: "vps", title: "VPS 订阅", detail: "Komari 节点 · 计费信息", nodes: vpsNodes },
  ];

  return (
    <div className="subscription-page">
      <header className="subscription-page-header">
        <div>
          <Link to="/" className="subscription-back"><ChevronLeft size={15} /> 返回看板</Link>
          <div className="subscription-kicker"><span /> NETWORK ASSETS / BILLING</div>
          <h1>订阅资产</h1>
          <p>集中查看静态家庭 IP 与 VPS 的到期时间、计费周期和订阅金额。</p>
        </div>
        <div className="subscription-header-counts">
          <div><span>STATIC IP</span><strong>{staticNodes.length}</strong></div>
          <div><span>VPS</span><strong>{vpsNodes.length}</strong></div>
        </div>
      </header>

      {sections.map((section) => (
        <section className="subscription-section" key={section.id} aria-label={section.title}>
          <div className="subscription-section-heading">
            <div><span>{section.id === "static" ? "01 / RESIDENTIAL" : "02 / INFRASTRUCTURE"}</span><h2>{section.title}</h2><p>{section.detail}</p></div>
            <strong>{section.nodes.length} 项资产</strong>
          </div>
          {section.nodes.length > 0 ? (
            <div className="subscription-grid">
              {section.nodes.map((node) => <SubscriptionCard key={`${node.type}-${node.id}`} node={node} maskStaticIp={maskStaticIp} />)}
            </div>
          ) : (
            <div className="subscription-empty">
              {section.id === "static" && staticLoading ? "正在加载静态 IP 订阅…" :
                section.id === "static" && staticError ? `静态 IP 数据加载失败：${staticError.message}` :
                  section.id === "static" ? "暂无静态 IP 数据，请在主题设置中配置数据源。" : "暂无 VPS 节点数据。"}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function Subscriptions() {
  const vpsDisplays = useVisibleNodes();
  const settings = useNetworkSettings();
  const assets = useNetworkAssets(vpsDisplays, { ...settings, showStaticIps: true, showRiskScore: false });
  return <SubscriptionPortfolio assets={assets.allNodes} maskStaticIp={settings.maskStaticIp} staticLoading={assets.staticLoading} staticError={assets.staticError} />;
}
