# komari-theme-YS

komari-theme-YS 是一个面向 [Komari](https://github.com/komari-monitor/komari) 的主题，融合了众多主题的交互与展示思路。

![komari-theme-YS Preview](./preview-readme.png)

## 截图

白日模式首页截图：

<img src="https://cdn.nodeimage.com/i/wuhwH0FgiURqIDg1ao0mx5mE3P9v52cJ.webp" alt="wuhwH0FgiURqIDg1ao0mx5mE3P9v52cJ.webp">
<img src="https://cdn.nodeimage.com/i/x8ftY5VfZm5hK7ZgnYYMXltYGKEs3B5R.webp" alt="x8ftY5VfZm5hK7ZgnYYMXltYGKEs3B5R">

夜间模式首页截图：

<img src="https://cdn.nodeimage.com/i/tq7weonNbaXutEGchAmY2zYdF5DuTCkR.webp" alt="tq7weonNbaXutEGchAmY2zYdF5DuTCkR">
<img src="https://cdn.nodeimage.com/i/IPPto39Pc50gO56msFfC2wepdQ5XIVYY.webp" alt="IPPto39Pc50gO56msFfC2wepdQ5XIVYY">
管理面截图：

<img src="https://cdn.nodeimage.com/i/M14h8OZSdb8CyFmlXNCiR4B7XWR1yF2N.webp" alt="M14h8OZSdb8CyFmlXNCiR4B7XWR1yF2N">

<img src="https://cdn.nodeimage.com/i/90WStM408r5i3Rsh66C7MgqL04HWmoW7.webp" alt="90WStM408r5i3Rsh66C7MgqL04HWmoW7">

## 特性

### 首页与总览

- 首页顶部总览可显示当前时间、节点总数、在线数量、点亮地区、总上下行流量、总流量速率、总 CPU、总内存和总硬盘。
- 顶部信息支持显示开关、拖拽排序和每行数量设置，可在首页快捷面板临时调整，也可由管理员保存为全站默认。
- 节点卡片支持方型卡片和条形卡片两种形态：方型适合展示完整信息展板，条形适合大量节点和移动端快速浏览。
- WebSocket 刷新策略参考官方主题，首页节点状态、流量速率和在线状态尽量兼顾实时性与稳定性。

### 卡片与信息展板

- 卡片外壳内置数据面板、清透玻璃、霓虹暗面、柔和彩块、极简白板和复古 CRT 等预设。
- 信息展板支持数据条、弧光仪表、全环仪表、指针仪表和液位容器，可在首页快捷面板直接切换。
- 数据条支持经典点阵、极光丝带、电路线条、霓虹脉冲、均衡器方块等动态样式，并可调整密度、圆角、光晕和动效强度。
- 方型卡片的数据条模式可显示流量额度，按 Komari 的 `traffic_limit_type` 展示已用 / 总量和百分比进度；没有配置额度时可显示 `∞` 总量。
- 跑马灯配色提供多组醒目预设，也支持分别自定义 CPU、内存、磁盘、负载、上下行、延迟和丢包颜色。

### 仪表与液位容器

- 弧光仪表、全环仪表和指针仪表支持粗细、光晕、动效、紧凑度、中心数值、指针和刻度强度等专属调整。
- 环形样式内置清透光环、霓虹双轨、分段刻度、柔光厚环、极简细线、碎片轨道、脉冲齿环、液态胶囊、电路星轨、声波脉冲、双轨错位、极光丝带环和断点扫描等预设。
- 液位容器支持水波圆球、横向胶囊舱、竖向液柱、椭圆透镜、分段胶囊、六边晶核、悬浮水滴、环形液舱等实体化容器形态。
- 液位容器保留轻量动态水波、液面晃动、气泡、扫描、刻度、晶体切面和传输节点等细节，并对多节点场景做了性能取舍。

### 背景与配色

- 渐变背板整合在“卡片与样式”面板中，和卡片外壳、信息展板、顶部信息、配色同级。
- 渐变背板内置薄荷、天青、晨粉、极光、灰白等预设，也可自定义颜色、角度、柔和度、网格和透明度。
- 背板玻璃可让节点卡片、顶部总览和部分色块跟随当前渐变背板同步染色，并可调整色块透明度。
- 图片背景板支持图片链接和本地上传，支持多图轮换、动态图片、透明度、模糊、图片置顶显示和快捷启用/关闭。
- 大尺寸 JPEG 背景会自动优化，减少主题设置保存时的卡顿。

### 排序与 Ping

- 首页服务器排序支持自定义顺序、到期时间、名称、在线时长和 CPU 占用排序。
- 自定义排序支持拖拽调整，也保留置顶、上移、下移、置底按钮；新服务器会自动追加到列表末尾。
- CPU 排序使用可配置快照间隔，减少实时状态频繁变化造成的排序跳动。
- 首页快捷面板支持本机排序覆盖，管理员可在主题管理页保存全站默认排序。
- 主页延迟检测可为首页节点卡片绑定 Ping 任务，支持一键将所有服务器绑定到同一个 Ping 任务。
- 未配置 Ping 时可选择自动隐藏、显示占位或仅绑定节点显示；默认自动隐藏，避免没有配置 Ping 的首页出现无意义的延迟/丢包占位。

### 详情页与维护

- 节点详情页整合 Mochi 与 PurCarte 的一些优点，偏向高信息密度的状态展示。
- 详情页支持负载历史和 Ping 历史时间范围选择，可按实时、1 小时、4 小时、1 天、7 天、30 天、300 天等范围查看。
- 主题配置不走 `/admin/theme_managed` 的托管配置，而是通过 `?view=theme-manage` 提供前端配置页。
- 项目内置 [AI 交接与维护说明](./docs/AI_HANDOFF.md)，整理了文件职责、Komari 接口、配置字段和发版检查项，方便后续维护。

## 主题管理面板

komari-theme-YS 自带一个前端主题管理面板，入口不是后台菜单，而是首页右上角的一枚小按钮。

- 入口位置：登录后，首页右上角外观切换按钮旁边的滑杆图标按钮。
- 直接访问：`/?view=theme-manage`
- 主要用途：集中调整 komari-theme-YS 的默认外观、首页排序、首页 Ping 展示绑定与相关主题展示偏好。

目前面板里主要可以做这些事情：

- 设置主题默认外观：浅色、深色或跟随系统。
- 设置首页服务器排序：自定义、到期时间、名称、在线时长、CPU 占用，并可调整 CPU 快照排序间隔。
- 拖拽调整首页服务器自定义顺序，也可以用按钮快速置顶、上移、下移或置底。
- 配置首页延迟检测：为首页节点卡片绑定对应的 Ping 任务，支持一键绑定全部节点，并可设置未配置 Ping 时的展示策略。
- 设置全站默认卡片形态、卡片外壳、背板玻璃、信息展板、数据条动态样式、液位容器、仪表细节、指标配色和跑马灯配色。
- 设置顶部信息的显示项、拖拽顺序和每行数量。
- 设置全站默认渐变背板和图片背景板。
- 统一查看当前已绑定的首页 Ping 节点数量，并按任务筛选和搜索。
- 在保存前预览当前配置状态，必要时一键重置本次修改。

如果首页看不到这个按钮，通常是因为当前还没有登录。

## 安装

1. 下载最新的 `komari-theme-YS-vX.Y.Z.zip`。
2. 登录 Komari 后台，在主题管理中上传 ZIP 包并启用。

主题包内包含以下 Komari 主题所需文件：

- `dist/`
- `komari-theme.json`
- `preview.png`

## 开发

要求：

- Node.js 22+
- npm

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

构建：

```bash
npm run build
```

打包 Komari 主题 ZIP：

```bash
npm run package
```

维护和二次开发前，建议先阅读 [AI 交接与维护说明](./docs/AI_HANDOFF.md)，里面整理了项目文件职责、Komari 接口、主题配置字段和发版检查项。

## 参考

- [Komari 主题开发文档](https://komari-document.pages.dev/dev/theme.html)
- [Komari API 文档](https://komari-document.pages.dev/dev/api.html)
- [Komari RPC 文档](https://komari-document.pages.dev/dev/rpc.html)
- [官方主题 komari-web](https://github.com/komari-monitor/komari-web)
