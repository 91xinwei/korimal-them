import { useState } from "react";
import { EyeOff, Globe2, HouseWifi, ShieldCheck, WalletCards } from "lucide-react";
import {
  normalizeNetworkAssetSettings,
  type NetworkAssetSettings,
  type ManagedStaticIpEntry,
} from "@/config/network";
import { loadBundledStaticIpEntries } from "@/services/static-ip";

function SettingSwitch({
  label,
  description,
  enabled,
  onToggle,
  icon,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="gradient-surface-sync">
      <div>
        <div className="gradient-surface-title inline-flex items-center gap-2">{icon}{label}</div>
        <div className="gradient-surface-subtitle">{description}</div>
      </div>
      <button
        type="button"
        className="instance-toggle-button instance-switch-button gradient-panel-switch"
        data-active={enabled ? "true" : "false"}
        aria-pressed={enabled}
        onClick={onToggle}
      >
        <span className="instance-switch-track" aria-hidden><span className="instance-switch-thumb" /></span>
        <span className="instance-switch-state">{enabled ? "开启" : "关闭"}</span>
      </button>
    </div>
  );
}

export function NetworkAssetsSettingsPanel({
  settings,
  onChange,
}: {
  settings: NetworkAssetSettings;
  onChange: (settings: NetworkAssetSettings) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const update = (patch: Partial<NetworkAssetSettings>) =>
    onChange(normalizeNetworkAssetSettings({
      ...settings,
      ...patch,
      latencyWarningThreshold: patch.thresholds?.latencyWarning ?? settings.thresholds.latencyWarning,
      packetLossWarningThreshold: patch.thresholds?.packetLossWarning ?? settings.thresholds.packetLossWarning,
      riskWarningThreshold: patch.thresholds?.riskWarning ?? settings.thresholds.riskWarning,
      staticStaleAfterSeconds: patch.thresholds?.staleAfterSeconds ?? settings.thresholds.staleAfterSeconds,
    }));

  const patchEntry = (index: number, patch: Partial<ManagedStaticIpEntry>) => {
    const entries = settings.staticIpNodes.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry);
    update({ staticIpNodes: entries });
  };

  const importBundled = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const entries = await loadBundledStaticIpEntries(settings.thresholds);
      update({ staticIpSource: "theme", staticIpNodes: entries });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "读取内置清单失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="visual-style-section home-modules-settings network-settings-panel">
      <SettingSwitch
        label="Global Network Map"
        description="按统一节点模型绘制 VPS 与 Static IP；地图模块保持按需加载"
        enabled={settings.showGlobalMap}
        onToggle={() => update({ showGlobalMap: !settings.showGlobalMap })}
        icon={<Globe2 size={14} />}
      />
      <SettingSwitch
        label="Static IP"
        description="控制首页 Static IP 卡片；独立订阅页面始终可查看已配置清单"
        enabled={settings.showStaticIps}
        onToggle={() => update({ showStaticIps: !settings.showStaticIps })}
        icon={<HouseWifi size={14} />}
      />
      <SettingSwitch
        label="风险与解锁信息"
        description="显示风险分、代理检测与流媒体解锁结果"
        enabled={settings.showRiskScore && settings.showUnlockStatus}
        onToggle={() => update({
          showRiskScore: !(settings.showRiskScore && settings.showUnlockStatus),
          showUnlockStatus: !(settings.showRiskScore && settings.showUnlockStatus),
        })}
        icon={<ShieldCheck size={14} />}
      />
      <SettingSwitch
        label="月费"
        description="在节点卡片和 Network Overview 中显示可用的月费信息"
        enabled={settings.showMonthlyPrice}
        onToggle={() => update({ showMonthlyPrice: !settings.showMonthlyPrice })}
        icon={<WalletCards size={14} />}
      />
      <SettingSwitch
        label="Static IP 脱敏"
        description="默认遮盖地址尾段；不影响 Adapter 内部的标准化数据"
        enabled={settings.maskStaticIp}
        onToggle={() => update({ maskStaticIp: !settings.maskStaticIp })}
        icon={<EyeOff size={14} />}
      />

      <div className="network-settings-fields">
        <label className="network-settings-field is-wide">
          <span>IP 检测 API URL（VPS / Static IP）</span>
          <input
            type="text"
            value={settings.ipQualityApiUrl}
            placeholder="/api/ip-quality"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...settings, ipQualityApiUrl: event.target.value })}
            onBlur={() => update({ ipQualityApiUrl: settings.ipQualityApiUrl })}
          />
          <small>在主题设置中填写检测服务 URL；按节点 ID 返回每日信誉结果，同时匹配 VPS 和静态 IP。默认 /api/ip-quality；正式站点需部署仓库的每日检测服务。</small>
        </label>
        {settings.staticIpSource === "url" && (
          <label className="network-settings-field is-wide">
            <span>Static IP API URL</span>
            <input
              type="text"
              value={settings.staticIpApiUrl}
              placeholder="/data/static-ips.json"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ ...settings, staticIpApiUrl: event.target.value })}
              onBlur={() => update({ staticIpApiUrl: settings.staticIpApiUrl })}
            />
            <small>默认读取主题包内 JSON；未来接入供应商时可填自有接口。</small>
          </label>
        )}
        <label className="network-settings-field">
          <span>刷新间隔（秒）</span>
          <input
            type="number"
            min={30}
            max={300}
            step={5}
            value={Math.round(settings.staticRefreshInterval / 1000)}
            onChange={(event) => update({ staticRefreshInterval: Number(event.target.value) * 1000 })}
          />
        </label>
        <label className="network-settings-field">
          <span>地图默认缩放</span>
          <input
            type="number"
            min={1.1}
            max={4}
            step={0.05}
            value={settings.mapDefaultZoom}
            onChange={(event) => update({ mapDefaultZoom: Number(event.target.value) })}
          />
        </label>
        <label className="network-settings-field">
          <span>延迟告警（ms）</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={settings.thresholds.latencyWarning}
            onChange={(event) => update({ thresholds: { ...settings.thresholds, latencyWarning: Number(event.target.value) } })}
          />
        </label>
        <label className="network-settings-field">
          <span>丢包告警（%）</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={settings.thresholds.packetLossWarning}
            onChange={(event) => update({ thresholds: { ...settings.thresholds, packetLossWarning: Number(event.target.value) } })}
          />
        </label>
        <label className="network-settings-field">
          <span>风险告警</span>
          <input
            type="number"
            min={0}
            max={100}
            value={settings.thresholds.riskWarning}
            onChange={(event) => update({ thresholds: { ...settings.thresholds, riskWarning: Number(event.target.value) } })}
          />
        </label>
        <label className="network-settings-field">
          <span>离线判定（秒）</span>
          <input
            type="number"
            min={30}
            max={86400}
            value={settings.thresholds.staleAfterSeconds}
            onChange={(event) => update({ thresholds: { ...settings.thresholds, staleAfterSeconds: Number(event.target.value) } })}
          />
        </label>
      </div>

      <div className="network-settings-provider-help">
        <strong>Static IP 维护方式</strong>
        <p>选择“主题内维护”后，清单保存在 Komari 的 theme_settings 中，不需要额外 Static IP 服务。公开主题配置会下发完整 IP；脱敏开关只影响画面。</p>
        <div className="instance-segmented is-scrollable">
          <button type="button" data-active={settings.staticIpSource === "url"} onClick={() => update({ staticIpSource: "url" })}>主题包 JSON / Provider URL</button>
          <button type="button" data-active={settings.staticIpSource === "theme"} onClick={() => update({ staticIpSource: "theme" })}>主题内维护</button>
        </div>
      </div>

      {settings.staticIpSource === "theme" && (
        <div className="network-settings-provider-help">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>静态 IP 清单 · {settings.staticIpNodes.length} 条</strong>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="theme-manage-button is-compact" disabled={importing} onClick={() => void importBundled()}>{importing ? "正在导入…" : "导入内置清单"}</button>
              <button type="button" className="theme-manage-button is-compact is-primary" onClick={() => update({ staticIpNodes: [...settings.staticIpNodes, { id: `static-${Date.now()}`, name: "", ipCategory: "residential" }] })}>添加静态 IP</button>
            </div>
          </div>
          {importError && <p role="status">{importError}</p>}
          <p>保存后首页、地图与“订阅资产”页同步更新。请勿填写代理账号、密码或服务商 API Key。</p>
          {settings.staticIpNodes.map((entry, index) => (
            <div key={index} className="static-ip-editor-entry">
              <div className="flex items-center justify-between gap-3"><strong>{entry.name || `新静态 IP #${index + 1}`}</strong><button type="button" className="theme-manage-button is-compact is-danger" onClick={() => update({ staticIpNodes: settings.staticIpNodes.filter((_, entryIndex) => entryIndex !== index) })}>移除</button></div>
              <div className="network-settings-fields">
                {([
                  ["id", "唯一 ID"], ["name", "名称"], ["ipv4", "IPv4"], ["country", "国家/地区"], ["countryCode", "国家代码"],
                  ["isp", "ISP 运营商"], ["provider", "供应商/产品"], ["planName", "套餐名称"], ["asn", "ASN"], ["currency", "币种（USD/EUR）"],
                ] as const).map(([key, label]) => (
                  <label className="network-settings-field" key={key}><span>{label}</span><input type="text" value={entry[key] ?? ""} onChange={(event) => patchEntry(index, { [key]: event.target.value })} /></label>
                ))}
                <label className="network-settings-field"><span>IP 类型</span><select value={entry.ipCategory ?? "residential"} onChange={(event) => patchEntry(index, { ipCategory: event.target.value })}><option value="residential">静态家庭 IP</option><option value="isp">ISP</option><option value="static-home">家庭宽带</option><option value="datacenter">数据中心</option></select></label>
                {([
                  ["monthlyPrice", "月费"], ["billingCycleDays", "计费周期（天）"], ["nextBillingAmount", "下次扣费金额"],
                ] as const).map(([key, label]) => (
                  <label className="network-settings-field" key={key}><span>{label}</span><input type="number" min={0} step="any" value={entry[key] ?? ""} onChange={(event) => patchEntry(index, { [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                ))}
                {([
                  ["subscriptionStartedAt", "订阅开始"], ["subscriptionExpiresAt", "到期时间"], ["nextChargeAt", "下次扣费"],
                ] as const).map(([key, label]) => (
                  <label className="network-settings-field" key={key}><span>{label}</span><input type="date" value={entry[key]?.slice(0, 10) ?? ""} onChange={(event) => patchEntry(index, { [key]: event.target.value })} /></label>
                ))}
                <label className="network-settings-field"><span>自动续费</span><select value={entry.autoRenew == null ? "unknown" : entry.autoRenew ? "yes" : "no"} onChange={(event) => patchEntry(index, { autoRenew: event.target.value === "unknown" ? undefined : event.target.value === "yes" })}><option value="unknown">未设置</option><option value="yes">开启</option><option value="no">关闭</option></select></label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="network-settings-provider-help">
        <strong>Static IP 数据从哪里添加？</strong>
        <p>
          可以在上方直接添加并保存到主题设置，不需要自建服务。若将来接入多个供应商，再切换到 Provider URL；
          两种来源都会经过 Adapter 转换成 StaticIpNode。
        </p>
        <details>
          <summary>查看最小可用 JSON 示例</summary>
          <pre>{`{
  "nodes": [{
    "id": "static-uk-01",
    "name": "UK Residential IP",
    "country": "United Kingdom",
    "countryCode": "GB",
    "city": "London",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "ipv4": "203.0.113.10",
    "provider": "Your Provider",
    "isp": "Example ISP",
    "status": "online",
    "latency": 128,
    "packetLoss": 0.5,
    "monthlyPrice": 6.95,
    "currency": "EUR",
    "subscriptionStartedAt": "2026-09-01T00:00:00Z",
    "subscriptionExpiresAt": "2026-10-01T00:00:00Z"
  }]
}`}</pre>
        </details>
      </div>
    </div>
  );
}
