# 订阅资产页面与主题内 Static IP 清单

主题新增 `/subscriptions` 页面，首页“查看订阅资产、到期时间与金额”可进入。页面复用 Komari 的 `/api/nodes` 节点数据与现有 StaticIpNode Adapter，不修改 VPS 卡片。VPS 的“本周期金额”取节点 `price`，折算月费按 `billing_cycle` 计算；到期日取 `expired_at`。Komari 没有订阅开始日时显示“未设置”，不把节点创建时间当作订阅开始。

管理员可在“主题设置 → 网络资产与 Static IP → Static IP 维护方式”选择“主题内维护”，直接添加、编辑、移除静态 IP，或先“导入内置清单”。点击页面顶部“保存”后，条目写入 Komari 的 `theme_settings.staticIpNodes`，首页卡片、地图和订阅资产页面共同读取。此模式不需要自建 Static IP 数据服务；未来需要自动同步多个供应商时，可切回 Provider URL，保持同一个 Adapter 转换入口。

`/api/public` 会把主题设置公开给访客。这里的 IP 地址和订阅金额适合公开展示；不要填写代理凭据、密钥或不希望公开的地址。“Static IP 脱敏”只改变页面文字，不是访问控制。若使用自有 Provider URL，也必须在服务端保护凭据。

VPS 的价格与到期日仍在 Komari 后台节点设置维护，不在主题中复制。IP 质量每日检测是另一项可选服务；主题内维护静态 IP 清单不等于自动进行 IP 信誉查询。
