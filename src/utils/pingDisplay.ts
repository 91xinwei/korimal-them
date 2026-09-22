import { normalizeHomepagePingTaskBindings } from "./pingTasks";

export type HomepagePingDisplayMode = "auto" | "placeholder" | "assigned";

export const DEFAULT_HOMEPAGE_PING_DISPLAY_MODE: HomepagePingDisplayMode = "auto";

export const HOMEPAGE_PING_DISPLAY_MODE_OPTIONS: Array<{
  value: HomepagePingDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "自动显示",
    description: "优先使用绑定任务；未绑定时自动选择该节点最新的 Ping 任务",
  },
  {
    value: "placeholder",
    label: "显示占位",
    description: "未绑定节点仍显示未配置提示",
  },
  {
    value: "assigned",
    label: "仅绑定显示",
    description: "始终只在已绑定节点显示延迟与丢包",
  },
];

export function normalizeHomepagePingDisplayMode(
  value: unknown,
): HomepagePingDisplayMode {
  return value === "placeholder" || value === "assigned" || value === "auto"
    ? value
    : DEFAULT_HOMEPAGE_PING_DISPLAY_MODE;
}

export function hasHomepagePingBindings(value: unknown): boolean {
  return Object.values(normalizeHomepagePingTaskBindings(value)).some(
    (clients) => clients.length > 0,
  );
}

export function shouldShowPingMetrics(
  mode: HomepagePingDisplayMode,
  _hasAnyBinding: boolean,
  isAssigned: boolean,
): boolean {
  if (mode === "placeholder") return true;
  if (mode === "assigned") return isAssigned;
  return true;
}
