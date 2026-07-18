import { Filter, Globe2, UserRound } from "lucide-react";
import type { HomeModuleSettings } from "@/hooks/useVisualStyle";

export function HomeModulesSettingsPanel({
  settings,
  onChange,
}: {
  settings: HomeModuleSettings;
  onChange: (settings: HomeModuleSettings) => void;
}) {
  return (
    <div className="visual-style-section home-modules-settings">
      <div className="gradient-surface-sync">
        <div>
          <div className="gradient-surface-title inline-flex items-center gap-2">
            <UserRound size={14} />
            访客信息
          </div>
          <div className="gradient-surface-subtitle">开启后每次访问首页自动弹出 IP、地区和服务商信息</div>
        </div>
        <button
          type="button"
          className="instance-toggle-button instance-switch-button gradient-panel-switch"
          data-active={settings.visitorInfo ? "true" : "false"}
          onClick={() => onChange({ ...settings, visitorInfo: !settings.visitorInfo })}
          aria-pressed={settings.visitorInfo}
        >
          <span className="instance-switch-track" aria-hidden>
            <span className="instance-switch-thumb" />
          </span>
          <span className="instance-switch-state">
            {settings.visitorInfo ? "显示" : "隐藏"}
          </span>
        </button>
      </div>

      <div className="gradient-surface-sync">
        <div>
          <div className="gradient-surface-title inline-flex items-center gap-2">
            <Filter size={14} />
            首页快捷筛选
          </div>
          <div className="gradient-surface-subtitle">控制搜索、分组、快捷筛选和运维工具整块显示</div>
        </div>
        <button
          type="button"
          className="instance-toggle-button instance-switch-button gradient-panel-switch"
          data-active={settings.explorerToolbar ? "true" : "false"}
          onClick={() => onChange({ ...settings, explorerToolbar: !settings.explorerToolbar })}
          aria-pressed={settings.explorerToolbar}
        >
          <span className="instance-switch-track" aria-hidden>
            <span className="instance-switch-thumb" />
          </span>
          <span className="instance-switch-state">
            {settings.explorerToolbar ? "显示" : "隐藏"}
          </span>
        </button>
      </div>

      <div className="gradient-surface-sync">
        <div>
          <div className="gradient-surface-title inline-flex items-center gap-2">
            <Globe2 size={14} />
            交互地球
          </div>
          <div className="gradient-surface-subtitle">顶部真实地球，可自转和拖动；关闭时不加载 3D 模块</div>
        </div>
        <button
          type="button"
          className="instance-toggle-button instance-switch-button gradient-panel-switch"
          data-active={settings.mapEnabled ? "true" : "false"}
          onClick={() => onChange({ ...settings, mapEnabled: !settings.mapEnabled })}
          aria-pressed={settings.mapEnabled}
        >
          <span className="instance-switch-track" aria-hidden>
            <span className="instance-switch-thumb" />
          </span>
          <span className="instance-switch-state">
            {settings.mapEnabled ? "开启" : "关闭"}
          </span>
        </button>
      </div>

      <div className="home-earth-settings-note">
        地球会根据当前搜索和筛选结果更新节点，离开视口或切换后台时自动暂停。
      </div>
    </div>
  );
}
