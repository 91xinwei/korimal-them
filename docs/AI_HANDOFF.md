# komari-theme-YS AI 交接与维护说明

这份文档给没有上下文的 AI 或开发者快速接手用。先读这里，再动代码。

## 项目定位

`komari-theme-YS` 是一个 Komari Monitor 前端主题，技术栈是 Vite + React + TypeScript + CSS。主题主体运行在 Komari 页面里，通过 Komari 的公开接口、管理员接口和 RPC2 获取节点、历史记录、Ping 任务、主题配置。

当前主题有几类核心能力：

- 首页节点卡片、条形卡片、顶部信息总览、排序。
- 节点详情页负载/Ping 历史图。
- 图片背景板、渐变背板、本地/全局外观配置。
- 卡片外壳、背板玻璃、信息展板、跑马灯、配色预设。
- 顶部信息支持显示开关、拖拽排序、每行数量、百分比条开关，以及总上下行流量/总流量速率拆开显示。
- 首页 Ping 支持未配置时自动隐藏、显示占位、仅绑定节点显示。
- 首页支持搜索、分组、快捷筛选、访客信息弹窗和真实交互地球。
- 首页运维工具包含健康摘要、异常集中、节点拓扑、共同故障分析和 JSON/CSV 快照导出。
- 负载/Ping 历史优先使用 Metric Store，新接口不可用时自动回退旧 records。
- 管理员主题设置页 `?view=theme-manage`，负责保存全站默认配置。

## 运行入口

- `src/main.tsx`：React 挂载入口。
- `src/App.tsx`：注入 React Query 和 Router。
- `src/router.tsx`：路由。首页 `/`、详情页 `/instance/:uuid`、404。
- `src/components/shell/AppShell.tsx`：全局外壳，挂载背景板、页面主体和 footer；快捷按钮 `FloatingControls` 会在首屏空闲后懒加载。
- `src/pages/Home.tsx`：首页。检测 `?view=theme-manage` 后懒加载主题设置页。

## 目录职责

```text
src/
  components/
    shell/       全局外壳、背景板、首页快捷按钮
    node/        首页节点卡片、总览、跑马灯、仪表盘/液位展板
    instance/    节点详情页、负载图、Ping 图
    ui/          小型通用 UI
  hooks/         主题外观、背景、节点排序、记录、登录态等业务 hook
  pages/         Home、Instance、ThemeManage 等页面入口
  pages/themeManage/
                 ThemeManage 拆出的选项、背景上传、Ping 绑定工具
  services/      Komari API、RPC2、节点实时状态 store、QueryClient
  styles/        全局样式入口、设计 token、按功能拆分的 surface 样式
  types/         Komari API 的 zod schema 和 TypeScript 类型
  utils/         格式化、背景设置、排序、Ping 绑定等纯工具
```

## 重点文件说明

| 文件 | 作用 | 修改建议 |
| --- | --- | --- |
| `src/services/api.ts` | 封装 Komari REST/RPC 接口，含 zod 校验和 fallback | 新增接口优先在这里集中封装，不要在组件里散写 `fetch` |
| `src/services/rpc2Client.ts` | RPC2 WebSocket + HTTP fallback 客户端 | 只在 RPC 协议变化时改 |
| `src/services/wsStore.ts` | 首页节点实时状态 store，轮询节点信息和最新状态 | 性能相关改动优先检查这里 |
| `src/types/komari.ts` | API schema、接口类型、主题配置类型 | 新增配置字段先补类型和 normalize |
| `src/pages/ThemeManage.tsx` | 管理员主题设置页主体 | 保持负责状态、保存、渲染，工具逻辑放子目录 |
| `src/pages/themeManage/themeManageOptions.ts` | 主题设置页选项常量和外观 normalize | 新增设置页固定选项放这里 |
| `src/pages/themeManage/backgroundUploads.ts` | 背景上传、DataURL 读取、JPEG 压缩优化 | 改上传限制、压缩策略从这里进 |
| `src/pages/themeManage/pingBindings.ts` | 首页 Ping 任务和节点绑定工具 | 改一键绑定、绑定裁剪从这里进 |
| `src/components/shell/FloatingControls.tsx` | 首页快捷面板：卡片与样式、排序、本地外观 | 渐变背板和背板玻璃都在卡片与样式页签内，实际字段仍属于 `gradientBackground` |
| `src/components/shell/BackgroundBoard.tsx` | 图片背景板和渐变背板实际渲染 | 背景层级、透明度、背板玻璃 CSS 变量从这里查 |
| `src/components/node/NodeGrid.tsx` | 首页节点列表、排序、卡片布局入口 | 新增排序模式时配合 `utils/nodeSort.ts` |
| `src/components/node/StatusOverview.tsx` | 首页顶部信息总览，渲染时间、数量、流量、速率、资源汇总 | 改顶部信息显示、拆分、进度条时从这里进 |
| `src/components/node/HomeExplorerToolbar.tsx` | 首页搜索、分组、快捷筛选、运维工具入口和访客信息容器 | 新增首页筛选或工具入口时从这里进 |
| `src/components/node/HealthSummaryPanel.tsx` | 健康摘要、历史峰值和异常集中 | 阈值、历史范围和风险列表从这里改 |
| `src/components/node/NodeTopologyPanel.tsx` | 分组拓扑、上下游标签和共同故障分析 | 上游标签语法和共同故障规则从这里改 |
| `src/components/node/SnapshotExportPanel.tsx` | 当前筛选节点的 JSON/CSV 导出 UI | 导出字段与安全处理主要在 `services/snapshot.ts` |
| `src/components/node/NodeGeoPanel.tsx` | 按需加载的 WebGL 交互地球、昼夜纹理、地区节点与图例 | 地球外观、交互、节点聚合、暂停和销毁逻辑从这里改 |
| `src/components/node/VisitorInfo.tsx` | 第三方 IP 信息源自动回退、顶层访客弹窗和默认头像 | 信息源、超时、自动弹出、ISP/ASN/Organization normalize 从这里改；默认头像位于 `public/assets/visitor-avatar.jpg` |
| `src/components/node/NodeCard.tsx` | 节点卡片主体渲染 | 尽量只放组件结构，绘制工具放 `dashboardHelpers.tsx` |
| `src/components/node/StatusCorePanel.tsx` | 状态核心展板的数据映射和 8 种悬浮/断裂形态 | 新增核心形态从这里进；保持纯 DOM/CSS 和边缘动画，不要复制液位 SVG |
| `src/components/node/CanvasStrip.tsx` | 数据条/跑马灯/趋势条的 Canvas 基础组件 | 已使用共享 ResizeObserver/IntersectionObserver，新增动画不要再为每条数据创建独立全局监听 |
| `src/components/node/dashboardHelpers.tsx` | 弧光/全环/指针/液位展板的数学、SVG、CSS 变量工具 | 新增仪表盘形态或样式优先放这里 |
| `src/components/node/marqueeStyle.ts` | 跑马灯 canvas 绘制和动画节奏 | 新增跑马灯样式从这里进 |
| `src/components/settings/TopInfoSettingsPanel.tsx` | 顶部信息设置面板，含显示、百分比条、拆开显示、拖拽排序、每行数量 | 新增顶部信息控制项时同步这里和 `useVisualStyle.ts` |
| `src/hooks/useVisualStyle.ts` | 卡片外壳、展板、跑马灯、配色的类型、默认值、normalize、本地状态 | 新增视觉配置字段必须先补这里 |
| `src/services/metrics.ts` | Metric Store 定义、查询、Ping 统计、旧图表数据转换和健康汇总 | 新版 Metric 接口适配集中在这里，不要散到组件 |
| `src/services/snapshot.ts` | JSON/CSV 快照组装、CSV 注入防护和下载 | 新增导出字段时保持公开可见范围和转义规则 |
| `src/utils/region.ts` | 地区代码、旗帜解析、地图坐标和中文名称 | 新增地区别名或坐标时从这里改 |
| `src/hooks/useGradientBackground.ts` | 渐变背板配置、本地/全局来源、CSS 变量设置 | 渐变预设和保存策略从这里改 |
| `src/hooks/usePingMini.ts` | 首页 Ping mini 汇总 store、定时刷新、按节点订阅 | 首页 Ping 显示策略和绑定数据流改动要注意请求数量 |
| `src/utils/backgroundSettings.ts` | 图片背景板配置 normalize、URL 解析、上传图来源 | 背景配置字段必须和这里保持一致 |
| `src/utils/nodeSort.ts` | 首页排序模式和排序函数 | 新增排序模式从这里进 |
| `src/styles/index.css` | 样式总入口 | 一般不用改 |
| `src/styles/tokens.css` | 颜色、阴影、基础变量 | 改全局视觉基调先看这里 |
| `src/styles/surface.css` | surface 样式导入文件 | 只维护导入顺序 |
| `src/styles/surface/foundation.css` | 背景板、快捷面板、设置页、总览等基础样式 | 快捷面板和设置页样式从这里进 |
| `src/styles/surface/instance.css` | 节点详情页样式 | 详情页图表和信息块样式从这里进 |
| `src/styles/surface/node-card.css` | 首页节点卡片、仪表盘、液位、卡片外壳样式 | 卡片外观和展板动画从这里进 |
| `src/styles/surface/status-core.css` | 状态核心布局、8 种形态、设置预览和响应式样式 | 保持无大外壳、仅边缘元素持续动画，并同步检查 `prefers-reduced-motion` |

## 数据流

首页数据大致是：

1. `NodeGrid` 调用 `useVisibleNodes()` / `useVisibleNodeUuids()`。
2. `useNode.ts` 启动 `wsStore.ensureStarted()`。
3. `wsStore.ts` 定时拉取 `/api/nodes` 和 RPC `common:getNodesLatestStatus`。
4. `NodeGrid` 读取 `useVisualStyle()`、`useNodeSort()` 后决定布局、排序、样式。
5. `StatusOverview` 用可见节点聚合顶部信息，并按 `topInfoOrder`、`topInfoColumns`、`topInfoSplit` 渲染。
6. `NodeGrid` 调用 `useHomepagePingOverviewForNodes(uuids)` 调度首页 Ping mini，复用当前排序后的节点列表。
7. 每张 `NodeCard` 自己读取实时节点、Ping mini 数据、流量趋势并渲染；浅色/深色状态由 `NodeGrid` 统一传入，避免每张卡重复订阅外观。
8. `NodeGrid` 在排序前应用搜索、分组和快捷筛选，地图、顶部总览、Ping 调度、运维工具和快照导出共同复用筛选结果。
9. 交互地球和三个运维面板使用 `React.lazy()`；只有开启地球或点击工具后才下载对应 chunk，地球的 Three.js / globe.gl 还会在组件内部再次动态导入。

主题设置保存大致是：

1. 管理员进入 `/?view=theme-manage`。
2. `ThemeManage.tsx` 从 `/api/public` 读取 `theme_settings`，normalize 成草稿。
3. 用户修改草稿后点击保存。
4. `saveThemeSettings(theme, settings)` POST 到 `/api/admin/theme/settings?theme=...`。
5. 保存成功后 invalidate `public-config`，前台 hook 自动读到新全局默认。

快捷面板保存策略：

- 游客/普通用户：多数外观配置保存在 localStorage，只影响当前浏览器。
- 管理员：主题设置页保存的是全站默认配置，由后端管理员接口保护。
- 不要依赖前端隐藏按钮做权限安全，真正安全边界必须是 `/api/admin/*`。

## Komari 接口清单

集中封装位置：`src/services/api.ts`。

| 函数 | 底层接口 | 用途 |
| --- | --- | --- |
| `getMe()` | `GET /api/me` | 判断登录状态、是否可看隐藏节点、是否可进入主题设置 |
| `getPublic()` | `GET /api/public` | 站点公开配置和 `theme_settings` |
| `getVersion()` | `GET /api/version` | Komari 版本信息 |
| `getNodes()` | `GET /api/nodes` | 节点基础信息 |
| `getNodesLatestStatus(uuids?)` | RPC `common:getNodesLatestStatus` | 节点实时状态 |
| `getAdminClients()` | `GET /api/admin/client/list` | 管理员节点列表，用于排序和 Ping 绑定设置 |
| `getLoadRecords(uuid, hours)` | RPC `common:getRecords`，失败回退 `/api/records/load` | 负载历史 |
| `getPingRecords(uuid, hours)` | 优先 `/api/records/ping`，失败回退 RPC `common:getRecords` | 节点 Ping 历史 |
| `getPublicPingTasks()` | `GET /api/task/ping` | 公开 Ping 任务 |
| `getAdminPingTasks()` | `GET /api/admin/ping` | 管理员 Ping 任务 |
| `getPingOverview(hours, taskId?)` | RPC `common:getRecords`，有 taskId 时可回退 `/api/records/ping` | 首页 Ping mini 汇总 |
| `saveThemeSettings(theme, settings)` | `POST /api/admin/theme/settings?theme=...` | 保存全站主题默认配置 |

Metric Store 集中在 `src/services/metrics.ts`：

| RPC 方法 | 用途 | 回退策略 |
| --- | --- | --- |
| `public:listMetricDefinitions` | 检测当前核心支持的指标 | 方法不存在时回到旧 records |
| `public:queryMetrics` | 负载、Ping 序列和健康历史峰值 | `api.ts` 继续调用原有 RPC / REST records |
| `public:getPingMetricStats` | Ping 延迟、丢包和波动统计 | 首页/详情继续使用旧 Ping records |
| `public:getPublicPingTasks` | 补齐 Metric Ping 任务信息 | 旧路径继续使用 `/api/task/ping` 或 records tasks |

采样上限：详情历史 720 点、健康摘要 240 点、首页 Ping 120 点。不要把首页和健康摘要恢复成详情图采样量。

RPC2 位置：`src/services/rpc2Client.ts`。默认先尝试 WebSocket `/api/rpc2`，失败后走 HTTP POST `/api/rpc2`。

## 主题配置字段

主题配置来自 `PublicConfig.theme_settings`，类型入口是 `src/types/komari.ts` 的 `ThemeSettings`。

常用字段：

```ts
interface ThemeSettings {
  defaultAppearance?: "system" | "light" | "dark";
  background?: ThemeBackgroundSettings;
  gradientBackground?: unknown;
  homepagePingBindings?: Record<string, string[]>;
  homepageNodeOrder?: string[];
  homepageNodeSort?: unknown;
  visualStyle?: {
    homeModules?: {
      visitorInfo?: boolean;
      mapEnabled?: boolean;
      mapMode?: "globe" | "map"; // 兼容旧配置；当前统一渲染交互地球
    };
  };
  showPingChart?: boolean;
  enableAdminButton?: boolean;
}
```

重要 normalize 位置：

- 图片背景板：`normalizeBackgroundSettings()` in `src/utils/backgroundSettings.ts`
- 渐变背板：`normalizeGradientBackgroundSettings()` in `src/hooks/useGradientBackground.ts`
- 视觉样式：`normalizeVisualStyleSettings()` in `src/hooks/useVisualStyle.ts`
- 首页 Ping 绑定：`normalizeHomepagePingTaskBindings()` in `src/utils/pingTasks.ts`
- 首页节点顺序：`normalizeHomepageNodeOrder()` in `src/utils/nodeOrder.ts`
- 首页节点排序：`normalizeHomepageNodeSortSettings()` in `src/utils/nodeSort.ts`

新增配置字段时必须同时处理：

1. 类型：`src/types/komari.ts`
2. 默认值和 normalize：对应 hook 或 util
3. 保存入口：`ThemeManage.tsx` 或 `FloatingControls.tsx`
4. 使用入口：组件或 hook
5. 文档：本文件和必要的 README/CHANGELOG

## 视觉配置关系

`useVisualStyle.ts` 是视觉设置核心：

- `cardStyle`：卡片外壳，当前包含数据面板、清透玻璃、霓虹暗面、柔和彩块、极简白板、复古 CRT。
- `cardLayout`：方卡片或条形卡片。
- `dashboardStyle`：信息展板，当前包含数据条、弧光仪表、全环仪表、指针仪表、液位容器、状态核心。
- `dashboardSettings`：各展板专属调节项。
- `marqueePalette` / `colors`：跑马灯指标颜色。
- `marqueeStyle`：数据条跑马灯的形态、密度、圆角、光晕、动效。
- `radarLatencyMaxMs`：延迟仪表上限，超过拉满。
- `showTrafficQuota`：数据条信息展板里的出入站额度统计显示开关。

展板渲染约定：

- 数据条的资源、流量额度继续统一复用 `MetricBar` / `CanvasStrip` / `drawMarqueeStrip`，不要为单个指标另写一套进度实现。
- 弧光、全环和指针共用 `RadarGauge`，几何与个性绘制放在 `dashboardHelpers.tsx`；半环内外层必须通过 `renderArcPath(..., radius)` 保持真实半径差。
- 液位形态共用 `LiquidGauge`。横向胶囊、分段胶囊和透镜依赖 `preserveAspectRatio="none"` 形成横向容器，不要改回正方形等比缩放。
- 状态核心使用独立 `dashboardStyle: "core"` 和 `dashboardSettings.core`；形态放在 `StatusCorePanel.tsx`，样式放在 `status-core.css`。不要并回 `LiquidGauge`，也不要让每个分段都持续动画。
- `topInfo`：顶部信息显示开关，项目包含当前时间、节点总数、当前在线、点亮地区、总上下行流量、总流量速率、总 CPU、总内存、总硬盘。
- `topInfoProgress`：顶部信息百分比条开关，目前只作用于当前在线、总 CPU、总内存、总硬盘。
- `topInfoSplit`：顶部信息拆开显示开关，目前只作用于总上下行流量和总流量速率；开启后分别渲染上传/下载、上行/下行独立卡片。
- `topInfoOrder`：顶部信息拖拽排序结果，保存原始项目 ID，不保存拆分后的派生 ID。
- `topInfoColumns`：顶部信息每行数量，`0` 表示自动，固定值支持 2/3/4/5/6。
- `homeModules`：首页独立模块设置，包含 `visitorInfo`、`explorerToolbar` 和交互地球开关。`mapMode` 仅为旧全站配置兼容字段，当前 `NodeGrid` 统一渲染 `NodeGeoPanel`。`explorerToolbar=false` 时会移除整块搜索/筛选/运维入口，并重置筛选和当前工具；normalize 会把旧 `healthSummary` 值迁移到该字段。

首页快捷面板里的渐变背板入口放在“卡片与样式”页签内，和卡片外壳、信息展板、配色同级。背板玻璃也在“卡片外壳”页签里，但配置字段仍是 `gradientBackground.tintSurfaces` 和 `gradientBackground.surfaceOpacity`，因为它依赖当前渐变背板颜色给卡片、总览和部分色块染色。

样式落地主要靠 `:root` 属性和 CSS 变量：

- `data-card-style`
- `data-dashboard-style`
- `data-gradient-surfaces`
- `--ys-metric-*`
- `--ys-gradient-*`

## 顶部信息总览

顶部信息相关入口：

- 配置模型：`src/hooks/useVisualStyle.ts`
- 设置面板：`src/components/settings/TopInfoSettingsPanel.tsx`
- 实际渲染：`src/components/node/StatusOverview.tsx`
- 首页传参：`src/components/node/NodeGrid.tsx`

注意事项：

- `topInfoOrder` 只存基础项 ID，例如 `traffic`、`rate`，不存 `traffic-up`、`rate-down`。
- `StatusOverview` 会先按 `topInfoOrder` 排序，再按 `topInfoSplit` 展开派生卡片。
- 拆分显示仍受原始项开关控制，关闭 `traffic` 会同时关闭上传/下载两个派生卡片。
- 右上角百分比和底部进度条由 `topInfoProgress` 控制，目前不要给流量/速率硬加百分比。
- 流量/速率大数字容易挤压，CSS 已按 `data-source-id="traffic"` 和 `data-source-id="rate"` 做紧凑字号。

## 性能注意点

首屏性能最近做过优化，维护时要避免回退：

- `FloatingControls` 在 `AppShell` 中通过 `DeferredFloatingControls` 懒加载，并等待 `requestIdleCallback` 或短延时后再加载；不要在首屏入口重新静态导入。
- `CanvasStrip` 使用共享 `ResizeObserver` 和共享 `IntersectionObserver`，并用全局动画循环调度绘制；新增跑马灯/趋势条时复用 `CanvasStrip`，不要每个组件自己创建 RAF 循环。
- 仪表动效使用 SVG 描边、坐标过渡和 CSS transform，不创建逐仪表 RAF；指针刻度已合并为两条静态 SVG path，避免恢复为每个刻度一个 DOM 节点。
- 液位性能保护位于 `surface/node-card.css` 的 `Liquid dashboard performance guard` 段，只保留水波、液面、单气泡、扫描和一个节点/数据包动画；不要重新启用整组 SVG filter 或所有装饰动画。
- `NodeGrid` 统一读取 `resolvedAppearance` 并传给 `NodeCard`，避免大量节点时每张卡重复订阅 `usePreferences()`。
- `usePreferences()` 不再手写额外 `/api/public` 请求，默认外观跟随 `usePublicConfig()`，避免首屏重复请求。
- 首页 Ping mini 调度使用 `useHomepagePingOverviewForNodes(uuids)`，复用当前节点列表，避免额外全局订阅和重复过滤。
- 地球和健康/拓扑/导出面板必须保持异步加载；地球默认关闭，不要把 `NodeGeoPanel`、Three.js 或 globe.gl 改回首屏静态导入。
- 地球渲染必须保留 DPR 上限、`IntersectionObserver` / `visibilitychange` 暂停和 `_destructor()` 清理；新增视觉效果前先评估多节点页面与手机 GPU 成本。
- `NodeGeoPanel` 使用地区标记签名过滤无关实时刷新，并跳过尺寸未变化的 `ResizeObserver` 通知；不要把 CPU、内存、流量等字段加入地球签名，否则会恢复高频 WebGL 数据同步。
- 昼夜纹理固定为 2048×1024，适配地球最大约 930 设备像素的实际画布；不要直接换回 4K 纹理。若未来放大地球，先对比视觉收益、下载体积和纹理解码显存。
- Metric Store 查询必须保留采样上限和定义检测，旧核心失败后立即回退，不要反复重试不存在的方法。
- 构建时可用 Vite 输出观察入口包体积。`v1.2.9-p1` 中入口包约从 gzip `102 kB` 降到 gzip `79 kB`。
- `v1.3.0-p6` 的入口 gzip 约 `82 kB`；Three.js 约 `190 kB gzip`、globe.gl 约 `381 kB gzip`，只在交互地球开启时下载。四张地球纹理合计约 `1.36 MB`，其中昼夜纹理合计约 `0.55 MB`。

## 常见开发入口

- 加排序：改 `src/utils/nodeSort.ts`，再看 `ThemeManage.tsx` 和 `FloatingControls.tsx` 是否需要设置入口。
- 加卡片外壳：改 `CARD_STYLE_PRESETS`、`normalizeVisualStyleSettings()`、`surface/node-card.css`。
- 改背板玻璃：入口在 `FloatingControls.tsx` 和 `ThemeManage.tsx` 的卡片与样式区，字段在 `useGradientBackground.ts`。
- 加展板样式：改 `DashboardStylePresetId`、默认值、`NodeCard.tsx` 渲染分支、`dashboardHelpers.tsx`、`surface/node-card.css`。
- 加液位形态：改 `LiquidShapeId`、`LIQUID_SHAPE_PRESETS`、`LiquidGauge` / `renderLiquidShape`、`surface/node-card.css`。
- 加跑马灯样式：改 `MarqueeShapeId`、`MARQUEE_STYLE_PRESETS`、`marqueeStyle.ts`。
- 改背景板：图片源在 `backgroundSettings.ts` / `BackgroundBoard.tsx`，渐变在 `useGradientBackground.ts` / `FloatingControls.tsx`。
- 改主题设置页：UI 在 `ThemeManage.tsx`，纯工具放 `src/pages/themeManage/`。
- 改首页搜索/快捷筛选：入口在 `NodeGrid.tsx` 和 `HomeExplorerToolbar.tsx`，筛选结果必须继续复用到总览、地图、Ping 和导出。
- 改健康摘要或 Metric Store：先看 `services/metrics.ts`，再看 `HealthSummaryPanel.tsx`；不要逐节点发送历史请求。
- 改拓扑：规则在 `NodeTopologyPanel.tsx`，当前识别 `upstream:`、`parent:`、`上游:`、`入口:` 标签。
- 改快照导出：字段和 CSV 安全在 `services/snapshot.ts`，UI 在 `SnapshotExportPanel.tsx`。

## 开发命令

```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit --pretty false
npm audit --audit-level=high
npm run build
npm run package
```

说明：

- `npm run lint` 使用根 `tsconfig`，有时对新增文件的报错不如 `tsc -p tsconfig.app.json` 直接，所以大改后两个都跑。
- `npm run build` 会先清理 `dist/`，再执行 `tsc -b && vite build`。
- `npm run package` 根据 `komari-theme.json` 生成 `komari-theme-YS-v版本号.zip`，如果同名包已存在会失败，避免覆盖旧版本。

## 发版检查

发版前至少确认：

1. `package.json`、`package-lock.json`、`komari-theme.json` 版本一致。
2. `komari-theme.json.url` 必须指向当前维护仓库 `https://github.com/91xinwei/korimal-them`。
3. `CHANGELOG.md` 顶部有当前版本更新内容。
4. `npm run lint`、`npx tsc -p tsconfig.app.json --noEmit --pretty false`、`npm audit --audit-level=high`、`npm run build` 通过。
5. `npm run package` 生成新的 zip，不能覆盖旧 zip。
6. 抽查 zip 内的 `komari-theme.json`，确认版本、作者、URL 正确。
7. 抽查 zip 内包含 `THIRD_PARTY_NOTICES.md`；交互地球实现或资源来源变化时同步更新该文件。

## 维护注意事项

- 不要删除旧 zip，用户需要回退测试。
- 不要把管理员权限逻辑只放在前端。前端按钮可以隐藏，但安全必须靠后端 `/api/admin/*`。
- 背景上传会把图片保存成 base64，配置体可能很大。保存卡顿时优先检查 `saveThemeSettings()`、上传图数量、图片大小和压缩策略。
- 动效卡顿优先查 CSS animation、canvas 绘制频率、`wsStore` 更新频率、`NodeCard` 重渲染。
- CSS 已按功能拆分，保持 `src/styles/surface.css` 的导入顺序，不要随意互换。
- 新增样式时先复用现有 CSS 变量，避免每个组件单独硬编码颜色。
