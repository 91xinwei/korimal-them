# Komari 官方数据契约核对

> 核对日期：2026-09-22。本文只引用 Komari 官方文档、`komari-monitor/komari` 和官方前端 `csznet/komari-web`。源码结论固定到 `komari` commit `7d692d2` 与 `komari-web` commit `34cb509`，避免分支后续变化导致引用漂移。

## 结论摘要

Komari 已经提供首页节点卡片所需的完整基础数据、实时状态和 Ping 统计，不需要主题另建数据接口：

- `GET /api/public` 返回站点公开配置，并在 `data.theme_settings` 暴露当前主题配置。
- `GET /api/nodes` 返回可见节点的静态信息数组；它是 RPC2 `public:getNodesInformation` 的 REST 桥接。
- RPC2 `common:getNodesLatestStatus` 返回实时资源状态，而且每个节点的 `ping` 字段已经包含最近一小时内**所有适用于该节点的 Ping 任务**的统计。
- `GET /api/task/ping` / RPC2 `public:getPublicPingTasks` 返回公开 Ping 任务，用任务 `id`、`name`、`clients`、`default_on` 等信息解释 `ping` map。
- `GET /api/records/ping`、RPC2 `public:getPingRecords` 或 `common:getRecords` 用于历史曲线；它们不是首页 RT/丢包的唯一来源。

因此，首页三网 RT/丢包应优先把 `latestStatus[uuid].ping` 与公开任务表按 task ID 联结，再按任务名称/显式主题绑定归类为电信、联通、移动。当前项目漏显示的主要原因是：实时状态解析链没有把官方已有的 `ping` map 纳入 UI 数据层，而历史聚合的“自动选择”又只给每个节点选择一个任务。

## 1. HTTP 路由与 RPC2 的对应关系

Komari 后端直接把几个历史 REST 路径绑定到公开 RPC 方法：

| HTTP 路径 | RPC2 方法 | REST `data` 内容 |
| --- | --- | --- |
| `GET /api/public` | `public:getPublicSettings` | 公开站点设置对象 |
| `GET /api/nodes` | `public:getNodesInformation` | `Client[]` |
| `GET /api/records/ping?uuid=&task_id=&hours=` | `public:getPingRecords` | Ping 记录、任务统计 |
| `GET /api/task/ping` | `public:getPublicPingTasks` | 公开 Ping 任务数组 |

依据：官方路由注册代码明确声明这四个绑定。[router.go#L56-L62](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/router/router.go#L56-L62)

REST 桥接返回 Komari 通用信封，即 `{ status, message, data }`；RPC2 则按 JSON-RPC 2.0 返回 `{ jsonrpc: "2.0", result, id }`。官方 API 文档列出 `/api/rpc2`、请求/响应结构和公开方法表。[官方 API 文档](https://komari-document.pages.dev/dev/api)

## 2. `/api/public` 数据契约

官方前端的类型至少使用以下字段：

```ts
interface PublicInfo {
  allow_cors: boolean;
  custom_body: string;
  custom_head: string;
  description: string;
  disable_password_login: boolean;
  oauth_provider: string;
  oauth_enable: boolean;
  ping_record_preserve_time: number;
  record_enabled: boolean;
  record_preserve_time: number;
  sitename: string;
  private_site: boolean;
  theme: string;
  theme_settings: unknown;
}
```

官方前端直接 `fetch("/api/public")` 并读取 `resp.data`。[PublicInfoContext.tsx#L3-L73](https://github.com/csznet/komari-web/blob/34cb509e1bec85a2b8bc2fbd96d0af99a31a67dc/src/contexts/PublicInfoContext.tsx#L3-L73)

主题设置的正式读取方式就是 `GET /api/public` 的 `data.theme_settings`；官方主题文档还说明 managed 配置会合并默认值，并过滤已删除的节点/Ping 任务 ID。[主题开发文档](https://komari-document.pages.dev/dev/theme)

## 3. `/api/nodes` 数据契约

`GET /api/nodes` 返回可见 `Client[]`。主要字段来自官方 `models.Client`：

```ts
interface NodeInfo {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  cpu_physical_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  ipv4?: string;
  ipv6?: string;
  region: string;
  public_remark?: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  weight: number;
  price: number;
  billing_cycle: number;
  auto_renewal: boolean;
  currency: string;
  expired_at: string | null;
  group: string;
  tags: string;
  traffic_limit: number;
  traffic_limit_type: "sum" | "max" | "min" | "up" | "down" | string;
  created_at: string;
  updated_at: string;
}
```

完整 Go 模型见 [models.go#L11-L48](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/database/models/models.go#L11-L48)。公开接口过滤 hidden 节点，并清空 IPv4、IPv6、remark、version 和 token；因此访客卡片不能假定这些敏感字段一定存在。[public.go#L45-L68](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/public.go#L45-L68)

注意：RPC2 `common:getNodes` 返回 `{ [uuid]: Client }`，不是数组；官方前端会用 `Object.values(result)` 转成列表。[NodeListContext.tsx#L66-L107](https://github.com/csznet/komari-web/blob/34cb509e1bec85a2b8bc2fbd96d0af99a31a67dc/src/contexts/NodeListContext.tsx#L66-L107)

## 4. 最新节点状态：`common:getNodesLatestStatus`

请求：

```json
{
  "jsonrpc": "2.0",
  "method": "common:getNodesLatestStatus",
  "params": { "uuids": ["node-uuid"] },
  "id": 1
}
```

参数可为空（全部节点），也可传单个 `uuid` 或多个 `uuids`。无单节点参数时结果为 `{ [uuid]: LatestStatus }`。官方方法元数据见 [common.go#L185-L210](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/common.go#L185-L210)。

精确响应字段：

```ts
interface LatestStatus {
  client: string;
  time: string;
  cpu: number;
  gpu: number;
  gpu_count?: number;
  gpu_average_usage?: number;
  gpu_detailed_info?: unknown[];
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  load5: number;
  load15: number;
  temp: number;
  disk: number;
  disk_total: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;       // TCP + UDP 总数
  connections_udp: number;
  online: boolean;
  uptime: number;
  ping: Record<string, PingStat>; // key 是十进制 task ID 字符串
}

interface PingStat {
  name: string;
  latest: number;
  avg: number;
  tail: number;
  loss: number; // 百分比，0..100
  min: number;
  max: number;
}
```

字段定义与组装见 [common.go#L287-L399](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/common.go#L287-L399)。`ping` 的算法读取最近一小时记录，负值表示丢包；`latest` 是最近有效延迟，`loss = lossCount / total * 100`，结果按 task ID 建 map，并缓存一分钟。[common.go#L39-L143](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/common.go#L39-L143)

官方前端每 2 秒调用此 RPC 并映射 CPU、内存、磁盘、网络、连接数、在线状态和 uptime。[LiveDataContext.tsx#L30-L111](https://github.com/csznet/komari-web/blob/34cb509e1bec85a2b8bc2fbd96d0af99a31a67dc/src/contexts/LiveDataContext.tsx#L30-L111)

## 5. Ping 任务和历史记录

### 5.1 公开任务

`public:getPublicPingTasks` / `GET /api/task/ping` 返回：

```ts
interface PublicPingTask {
  id: number;
  weight: number;
  name: string;
  clients: string[];
  default_on: boolean;
  type: string;
  interval: number;
}
```

公开响应**故意不含 `target`**，不能依赖目标地址判断运营商；应使用 `id`、管理员显式绑定，或任务名称。官方公开 DTO 见 [public.go#L208-L233](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/public.go#L208-L233)。任务是否适用于节点由 `clients` 是否包含该 UUID 决定；`default_on` 只表示新节点是否自动加入，不代表当前所有节点。[pingTask.go#L15-L35](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/database/models/pingTask.go#L15-L35)

### 5.2 `public:getPingRecords`

至少必须给 `uuid` 或 `task_id`，`hours` 默认 4。响应：

```ts
interface PublicPingRecords {
  count: number;
  records: Array<{
    task_id?: number;
    time: string;
    value: number; // ms；负值代表丢包
    client?: string;
  }>;
  basic_info?: Array<{
    client: string;
    loss: number;
    min: number;
    max: number;
  }>;
  tasks?: Array<{
    id: number;
    name: string;
    type: string;
    interval: number;
    default_on: boolean;
    loss: number;
    min: number;
    max: number;
    avg: number;
    total: number;
    clients?: string[];
  }>;
}
```

契约和统计算法见 [public.go#L288-L454](https://github.com/komari-monitor/komari/blob/7d692d2faf276a7c12520faaa8c41c38584bb484/web/rpc/jsonrpc/public.go#L288-L454)。

### 5.3 `common:getRecords`

官方前端的迷你 Ping 图调用：

```ts
call("common:getRecords", { uuid, type: "ping", hours })
```

并将负值转换为图表中的 `null`，任务名称来自响应 `tasks`。[MiniPingChart.tsx#L57-L101](https://github.com/csznet/komari-web/blob/34cb509e1bec85a2b8bc2fbd96d0af99a31a67dc/src/components/MiniPingChart.tsx#L57-L101)

## 6. 官方前端如何组成节点卡片

官方前端分三条数据流：

1. 节点静态信息：`common:getNodes` → `NodeBasicInfo[]`。
2. 实时状态：每 2 秒 `common:getNodesLatestStatus` → live data map。
3. Ping 历史：节点卡片的迷你图按 UUID 调用 `common:getRecords({ type: "ping" })`。

`Node` 卡片用静态总量与实时 used 值计算内存/磁盘百分比，用 `net_out/net_in` 展示实时上下行，用累计流量与静态 `traffic_limit` 计算额度，并把 UUID 传给迷你 Ping 图。[Node.tsx#L33-L150](https://github.com/csznet/komari-web/blob/34cb509e1bec85a2b8bc2fbd96d0af99a31a67dc/src/components/Node.tsx#L33-L150)

## 7. 当前项目为什么会漏三网 RT/丢包

对照当前仓库代码可定位为以下差异：

1. `src/services/api.ts` 的 `getNodesLatestStatus()` 只把 RPC 结果当作通用 record 返回；`src/services/wsStore.ts` 合并实时资源时没有把官方 `record.ping` 建模进统一节点状态。因此后端已经算好的全部任务 RT/丢包没有直达卡片。
2. `src/hooks/usePingMini.ts` 的自动逻辑 `resolveAutomaticTasks()` 按“每个节点最近一条记录”只选择一个 task ID。即使同一节点存在电信、联通、移动三个任务，主 `items` map 仍天然只有一个任务。
3. 多任务 `series` 虽会收集记录，但依赖历史 Ping 查询成功、记录落在查询窗口内、且组件正确消费 series。首页不应因历史接口暂时失败而丢掉 `latestStatus.ping` 中已存在的数据。
4. 公开任务接口不返回 `target`。若运营商识别依赖 `task.target`，公开页面一定拿不到；应使用显式的 `theme_settings` 三网 task-ID 配置，并以任务名称关键词作为兼容回退。
5. `default_on` 不是“此任务应用于所有现有节点”；真实分配仍以 `clients.includes(uuid)` 为准。错误地把 `default_on` 当实时分配条件，也会产生有任务却无该节点记录的假象。

## 8. 推荐接入方式

首页统一数据层应形成下面的只读联结，而不是让卡片自己 fetch：

```text
/api/nodes (NodeInfo[])
       +
common:getNodesLatestStatus (LatestStatus + ping map)
       +
/api/task/ping (task metadata)
       +
theme_settings (电信/联通/移动 task-ID 显式绑定)
       ↓
UnifiedNode / CarrierPing[telecom, unicom, mobile]
       ↓
VPS Card / Network Overview / Global Network Map
```

具体优先级：

1. 实时 RT、丢包：直接读 `LatestStatus.ping[String(taskId)]`。
2. 三网任务归类：优先 `theme_settings` 中的 task-ID 配置；其次用公开任务 `name` 匹配“电信/telecom、联通/unicom、移动/mobile/CMCC”。
3. 历史色条和趋势：再请求 `public:getPingRecords` 或 `common:getRecords`；请求失败时保留实时统计，不隐藏三网行。
4. 一个节点允许同时绑定三个及以上 task ID，不能继续使用 `Map<uuid, taskId>` 这种一对一结构作为完整展示源。

这套接法完全复用 Komari 官方 API 层，也符合主题文档关于通过 `/api/public` 读取 `theme_settings` 的要求。
