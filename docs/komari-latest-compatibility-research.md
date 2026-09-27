# Komari 最新版本兼容性核对（2026-09-27）

## 官方版本与变化

- 官方 GitHub Releases 将 **1.5.1** 标为 Latest（2026-09-24）；1.5.1 本身主要新增 `/admin` 到 `/admin/dashboard` 的重定向，并固定前端发布来源。参见 [1.5.1 release](https://github.com/komari-monitor/komari/releases/tag/1.5.1)。
- 1.5.0 增加 GPU 最新/历史状态；1.5.0-fix1 修复第三方主题与 PWA 的兼容问题。1.5.0 **移除 Agent v1 上报协议**，该变化影响 Agent，而非主题读取节点的公开 API。参见 [官方发布记录](https://github.com/komari-monitor/komari/releases)。
- 官方[兼容性维护时间表](https://komari-document.pages.dev/dev/compatibility)说明：`/api/public` 旧字段 `record_enabled`、`record_preserve_time`、`ping_record_preserve_time` 列为计划移除项；旧 `/api/records/*`、`/api/clients`、`/api/recent/:uuid` 为独立兼容清理项。当前 1.5.1 API 文档仍列出 `/api/records/ping`，所以不能把“计划移除”误写成“已移除”。

## 当前看板 API 对照

| 当前代码 | 1.5.1 官方契约 | 判断 |
| --- | --- | --- |
| `GET /api/public`，`data.theme_settings` | [主题指南](https://komari-document.pages.dev/dev/theme)和[API 文档](https://komari-document.pages.dev/dev/api)保留 | 兼容；主题设置为公开数据，不能放秘密。 |
| `GET /api/nodes` | API 文档 3.6：standard 包装，`data: Client[]`；Guest 隐藏节点并清空 IP 等敏感值 | 兼容；不能指望 Guest 模式取得节点 IP。 |
| `/api/rpc2`：`common:getNodesLatestStatus`、`common:getRecords` | API 文档 12.2、12.7 仍列出；状态含 CPU、内存、磁盘、网络及 Ping | 兼容；GPU 新字段可选接入。 |
| `GET /api/task/ping`、`GET /api/records/ping` | API 文档 3.12、3.11 仍列出；公开 Ping Task 增加 `weight` | 当前兼容；对 `/api/records/*` 应保留 RPC2 兜底。 |
| `/api/public` 的旧保存时间字段 | 官方兼容时间表列为计划移除 | 当前代码用 schema 默认 0，时间范围会回退到预设值；不崩溃，但会失去服务端保留期限上限，建议以后改由新配置/记录实际可用性控制。 |

## 主题包规范

官方[主题开发指南](https://komari-document.pages.dev/dev/theme)要求可安装 ZIP 根目录包含 `komari-theme.json` 和 `dist/index.html`，保留固定 `<title>Komari Monitor</title>`、description 文本及 `</head>`/`</body>` hooks。`configuration.type=managed` 的设置由 `/api/public.data.theme_settings` 公开；`redirect` 可跳转站内主题设置页面，`/admin` 和 `/terminal` 由系统保留。1.5.1 的 `/admin` 新重定向与主题自有 `?view=theme-manage` 路由不直接冲突。

## 结论边界

以上是**官方源码/文档层面的静态契约核对**，不是在运行中的 Komari 1.5.1 实例上完成的端到端安装验收。需要在 1.5.1 实例上实际安装 ZIP，并检查公开页面、主题设置保存、RPC2 实时状态、Ping 图表及静态 IP 附加服务，才能宣布运行时完全兼容。
