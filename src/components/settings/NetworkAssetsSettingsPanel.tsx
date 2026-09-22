import { EyeOff, Globe2, HouseWifi, ShieldCheck, WalletCards } from "lucide-react";
import {
  normalizeNetworkAssetSettings,
  type NetworkAssetSettings,
} from "@/config/network";

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
  const update = (patch: Partial<NetworkAssetSettings>) =>
    onChange(normalizeNetworkAssetSettings({
      ...settings,
      ...patch,
      latencyWarningThreshold: patch.thresholds?.latencyWarning ?? settings.thresholds.latencyWarning,
      packetLossWarningThreshold: patch.thresholds?.packetLossWarning ?? settings.thresholds.packetLossWarning,
      riskWarningThreshold: patch.thresholds?.riskWarning ?? settings.thresholds.riskWarning,
      staticStaleAfterSeconds: patch.thresholds?.staleAfterSeconds ?? settings.thresholds.staleAfterSeconds,
    }));

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
        description="启用独立 Provider 数据源；关闭后不发起 Static IP 请求"
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
          <span>Static IP API URL</span>
          <input
            type="text"
            value={settings.staticIpApiUrl}
            placeholder="/api/static-ips"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...settings, staticIpApiUrl: event.target.value })}
            onBlur={() => update({ staticIpApiUrl: settings.staticIpApiUrl })}
          />
          <small>只保存无凭证 URL；API key/密码必须保留在服务端。</small>
        </label>
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
        <strong>Static IP 数据从哪里添加？</strong>
        <p>
          在上方填写由你自己的服务端提供的 JSON 接口地址。主题只发起读取请求，服务商密钥留在服务端，
          Provider 返回的数据会由 Adapter 统一转换成 StaticIpNode。
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
