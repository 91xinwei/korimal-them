# Komari 主题规范与本项目二次开发边界

> 调研与源码核对日期：2026-09-20。本文记录官方契约、`komari-theme-YS` 1.3.4 基线的实际实现，以及本次网络资产扩展必须维持的兼容边界。

## 1. 当前仓库状态与结论边界

当前工作区已经按用户授权从 `youshi01/Komari_theme` 1.3.4 基线初始化，并完成逐文件核对：

- `komari-theme.json` 使用合法的 `short = komari-theme-YS`，配置入口是 `redirect` 到 `?view=theme-manage`；
- `src/services/api.ts` 集中读取 `/api/public`、`/api/nodes`，并通过 `rpc2Client` 调用 `common:getNodesLatestStatus`；
- `src/services/wsStore.ts` 保留 2 秒实时状态轮询和约 30 秒基础节点信息刷新，不由卡片重复建请求；
- `NodeGrid -> NodeCard` 继续消费 `NodeDisplay`，原有 VPS 视觉结构、字段和实时刷新链未被替换；
- `npm run build` 仍是 `tsc -b && vite build`，输出 `dist/`；ZIP 脚本把 manifest、预览、许可证说明与 `dist/` 直接放在包根；
- `index.html` 仍包含 Komari 要求的 title/description placeholder；`AppShell` 仍渲染 `Powered by Komari Monitor.` footer；既有 theme settings hooks 均保留。

## 2. 官方主题包契约

### 2.1 `komari-theme.json`

官方主题以包根目录的 `komari-theme.json` 作为 manifest；安装 ZIP 解压后必须能在**第一层**直接看到该文件与主题入口/静态资源，不能再多包一层仓库目录。manifest 负责主题的身份元数据、入口/跳转方式以及可配置项声明，实际提交前必须按[官方主题开发文档](https://komari-document.pages.dev/dev/theme)和[官方仓库中的主题装载实现](https://github.com/komari-monitor/komari)校验，而不是自定义一套格式。

官方 manifest 结构已经确认：

```json
{
  "name": { "zh-CN": "主题名", "en": "Theme name" },
  "short": "ThemeShort",
  "description": { "zh-CN": "说明", "en": "Description" },
  "version": "1.0.0",
  "author": "Author",
  "url": "https://github.com/owner/repo",
  "preview": "preview.png",
  "configuration": {
    "type": "managed",
    "icon": "Settings",
    "name": { "zh-CN": "主题设置", "en": "Theme settings" },
    "data": []
  }
}
```

- 后端安装时强制要求 `name` 和 `short`；`short` 只能包含字母、数字、下划线和连字符，且不能是 `default`。
- `name`、`description`、`author` 可为普通字符串或多语言对象；`version`、`url`、`preview` 是建议补全的展示/发布字段。
- `configuration.type` 支持 `managed`、`raw`、`redirect`；缺失时按 `managed` 处理。`managed.data` 是配置项数组，`raw.data` 是非空 HTML，`redirect.data` 是站点根目录下的相对路径。
- managed 配置项支持的官方类型包括 `string`、`number`、`select`、`switch`、`title`、`textbox`、`richtext`、`nodes`、`pingtasks`。
- `configuration` 自 Komari 1.0.5 起支持；`raw` 和 `redirect` 需要服务端高于 1.2.0。
- 官方文档允许多语言 manifest 字段，但当前 Theme Market 提交校验器对 `name`、`version`、`author`、`description` 使用更严格的字符串校验。若要上架，需以市场校验器的实际规则为准。

参考项目当前 manifest 为 `name/short = komari-theme-YS`、版本 `1.3.4`，并使用 `configuration.type = "redirect"`、`configuration.data = "?view=theme-manage"` 打开自身设置页；这不会改变 Komari 的 API 路由。源码到位后仍须以实际 checkout 为准，不能依据本文重建 manifest。[`Komari_theme` manifest](https://github.com/youshi01/Komari_theme/blob/main/komari-theme.json)、[`AI_HANDOFF`](https://github.com/youshi01/Komari_theme/blob/main/docs/AI_HANDOFF.md)

### 2.2 HTML、SPA 与宿主钩子

官方主题并非普通的独立静态站点。实现和打包时必须保留：

- 精确的 `<title>Komari Monitor</title>` 与 `<meta name="description" content="A simple server monitor tool." />`；服务端会替换标题、描述，并在 `</head>`、`</body>` 前注入用户自定义内容；
- 可由 React 渲染、但文字必须保留的 `Powered by Komari Monitor.` 页脚；
- SPA fallback/redirect 行为；
- Komari 保留路由，尤其 `/api/*`、RPC2 及后台/主题管理路径，不能被前端路由兜底吞掉；
- 当前源码中已经存在的 Komari DOM/CSS/theme hooks，不能因“清理无用标记”而移除或改名。官方文档列出的 `km-*` 是默认主题提供的稳定钩子，并未声明每个自定义主题都必须重新实现整套类名。

这些标记必须从现有模板逐字继承。由于当前工作区没有入口 HTML，现阶段不能列出本项目内的实值清单；合并前应把产物与[官方主题开发文档](https://komari-document.pages.dev/dev/theme)及[Komari Web 前端仓库](https://github.com/csznet/komari-web)逐项比对。

### 2.3 ZIP 与 Theme Market

本地可安装包的基本结构是：ZIP 根目录直接包含 `komari-theme.json` 和 `dist/`，主模板位于 `dist/index.html`；`preview.png` 等根级资源按 manifest/现有发布脚本保留。不能打包整个 Git 仓库，不能形成 `theme-name/komari-theme.json` 这样的额外顶层目录，也不能遗漏相对路径资源。

[Komari Theme Market](https://github.com/komari-monitor/theme-market)的提交校验比“本地能导入”更严格：manifest 字段、版本、预览/说明资源、压缩包目录结构与发布元数据都要按 Market 规则检查。因此交付应同时做两次验证：一是把 ZIP 安装到 Komari，二是按 Market validator/工作流验证。参考主题的发布与目录组织可以交叉检查：[Komari Material](https://github.com/Liebesfreud/Komari-Material)、[Kumo](https://github.com/yuanhhs/komari-theme-kumo)。

## 3. 官方数据接口对应关系

主题应该通过集中 API 层消费 Komari 数据：

| 数据 | 官方入口 | 主题中的职责 |
| --- | --- | --- |
| 公共站点信息 | `GET /api/public` | 站点公共配置，并暴露当前主题可公开读取的 `theme_settings` |
| 节点列表/静态信息 | `GET /api/nodes` | 节点身份、分组、地区和能力等列表数据 |
| 节点实时状态 | RPC2 `common:getNodesLatestStatus` | 在节点基础信息上合并在线状态、资源、流量、连接等动态数据 |
| RPC2 长连接通道 | `GET /api/rpc2` WebSocket | 在持久连接上发送 JSON-RPC 请求并接收响应；不应误解成无需调用的自动推送 |
| RPC2 回退通道 | `POST /api/rpc2` HTTP | WebSocket 不可用时发送单条或批量 JSON-RPC 请求 |

端点与负载语义应以[Komari 官方仓库](https://github.com/komari-monitor/komari)和[Komari Web](https://github.com/csznet/komari-web)的当前实现为准。关键原则是：`theme_settings` 属于公开主题配置，只能放适合公开下发的数据，不能存供应商密钥或私有凭据；组件也不能直接散写 `fetch('/api/...')`，而应复用一个可测试、可替换的 API/client 层。

## 4. 当前 `Komari_theme` 的实际架构映射

基线是 Vite + React + TypeScript + Tailwind/CSS。源码调用链已经复核，关键职责如下：

- `api.ts`：集中承接 `/api/public`、`/api/nodes` 等 HTTP 数据，不在卡片组件内发请求；
- `rpc2Client`：封装 RPC2 的 WebSocket GET 与 HTTP POST 回退；
- `wsStore`：每 **2 秒**调用一次 bootstrap/实时状态刷新，并将 `/api/nodes` 基础信息同步节流为 **30 秒**；实现时应复用或协调该生命周期，避免 Static IP 功能在组件层另建大量计时器；
- `NodeGrid` / `NodeCard`：VPS 列表与现有 VPS Card 展示边界；此次只允许整理输入与增加兼容层，不重做其视觉和字段；
- `StatusOverview`：现有总体状态入口，可扩展为 Network Overview 的组合数据消费者；
- `NodeGeoPanel`：现有地域可视化入口，可作为 Global Network Map 的复用/扩展点；
- `komari-theme.json`：采用 redirect/SPA 配置，必须原样遵守官方包契约；
- 构建与发布：`npm run build` 执行 `tsc -b && vite build` 并输出 `dist/`；`npm run package` 读取 manifest，将根级 `komari-theme.json`、`preview.png`、`THIRD_PARTY_NOTICES.md` 和 `dist/` 打入版本化 ZIP，且拒绝覆盖同名旧包。

因此，本次实现保持 VPS Card 数据链为“官方 HTTP 节点数据 + `rpc2Client` 实时数据 → `wsStore`/现有 selector → `NodeGrid` → `NodeCard`”。新增的 `KomariAdapter` 只生成总览/地图所需的 `VpsNode` 投影，不回写或替换 `NodeDisplay`。

## 5. 参考主题可复用的模式

- [Komari Material](https://github.com/Liebesfreud/Komari-Material)：参考其官方数据接入、SPA 主题入口、宿主兼容和成品包结构；不复制其视觉系统覆盖当前 VPS Card。
- [Kumo](https://github.com/yuanhhs/komari-theme-kumo)：参考其组件拆分、响应式布局、主题配置消费和构建发布方式；仍以当前项目 API/store 为主。
- 两个参考主题只能提供实现模式，不能成为新的数据契约；Komari 官方仓库和官方开发文档优先级更高。

## 6. Static IP 的 Provider/Adapter 边界

新增功能应插在现有 API/store 与 UI 之间，而不是侵入 VPS Card：

```text
Komari /api + RPC2 -> KomariAdapter ----> VpsNode ------┐
供应商 A API --------> Provider A Adapter -> StaticIpNode ├-> 统一 selector -> Overview / Map
供应商 B API --------> Provider B Adapter -> StaticIpNode ┘
```

建议职责：

- `StaticIpProvider` 只负责获取某供应商原始响应，并表达加载/错误/刷新能力；
- 每个 `Adapter` 把供应商字段、单位、状态枚举和空值统一转换为 `StaticIpNode`；
- `StaticIpNode` 是 UI 唯一可见的静态 IP 契约，至少应稳定表达 id、展示名、IP（或脱敏值）、状态、供应商标识、地区/坐标、网络/线路、延迟/丢包、流量/配额与更新时间；可选字段必须显式可空；
- Provider 的凭据不得来自公开的 `theme_settings`；如浏览器无法安全持有凭据，应通过用户自有后端/代理获取；
- Static IP Card 只消费 `StaticIpNode`，不引用供应商响应类型；
- Network Overview 与 Global Network Map 消费 `VpsNode | StaticIpNode` 的共享只读投影，不把两者强行做成一个巨型模型；
- Static IP 的失败不得阻断 Komari VPS 的 RPC2 更新，二者 loading/error/last-updated 状态应隔离；
- 刷新、缓存、取消请求、退避和数据校验位于 provider/store 层，不进入展示组件。

## 7. 实施门禁与核对结果

以下门禁已经在功能代码接入前完成：

1. 读取并保存现有 `komari-theme.json`、入口 HTML 和 package scripts 的原样快照。
2. 用调用链确认 `/api/public`、`/api/nodes`、RPC2 GET/POST、`theme_settings`、`api.ts`、`rpc2Client` 与 `wsStore`。
3. 确认 `NodeCard` 的全部字段、截图对应关系、刷新来源和 selector；建立回归基线。
4. 确认 placeholder、footer、SPA fallback、保留路由和全部 `km-*` hooks 在源码与 build 产物中均存在。
5. 先实现 provider/adapter 与类型测试，再接 Static IP Card、Network Overview、Global Network Map。
6. 执行既有 lint/typecheck/test/build/package，检查 ZIP 根目录，并在真实 Komari 安装验证；如需上架，再运行 Theme Market 的更严格校验。

实现新增了 `StaticIpProvider -> StaticIpAdapter -> StaticIpNode` 独立链路。Provider 失败只影响 Static IP 区域，不中断 VPS 状态；公开设置只保存无凭证 URL、刷新间隔和展示阈值。任何供应商密钥都必须放在用户自有服务端代理，不进入浏览器、mock、`.env.example` 或 `theme_settings`。
