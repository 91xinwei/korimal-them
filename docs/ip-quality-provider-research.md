# IP 质量与信誉检测 Provider 调研

更新时间：2026-09-23

## 结论

建议首期采用 **IPQualityScore（主风险源）+ IPinfo（网络/隐私分类）+ AbuseIPDB（恶意举报补充）**。若更重视可离线部署、静态/动态属性和住宅代理识别，则用 **MaxMind GeoIP Insights / IP Risk** 替换或补充 IPinfo；`minFraud` 本身是交易风控产品，不应在没有交易上下文时把它的交易 `risk_score` 当作静态 IP 质量分。

主题前端不应直接调用任何供应商 API。API Key 必须保存在服务端，由 Static IP Provider 在服务端查询、缓存、归一化后，输出统一 `StaticIpQuality`。这也规避了 IPQS 将 Key 放在 URL、MaxMind Basic Auth、AbuseIPDB 明确禁止浏览器调用等泄密风险。

“IP 质量”应拆成两类概念：

- `reputationRiskScore`：第三方观察到的欺诈、攻击、滥用风险，0–100，越高越危险。
- `qualityScore`：本项目根据信誉风险、延迟、丢包、可用率和稳定性派生的展示分，0–100，越高越好。

供应商原始分数必须同时保留，不能只留下二次计算结果。

## Provider 对比

| Provider | 主要能力 | 原始分数语义 | 对静态住宅/机房 IP 的价值 | 主要限制 |
| --- | --- | --- | --- | --- |
| IPQualityScore | Proxy、VPN、Tor、住宅代理、Bot、近期滥用、连接类型、ISP/地理信息 | `fraud_score` 0–100，越高越可能与恶意行为相关；官方建议 85+ 可疑、90+ 高风险 | 最适合直接提供“风险仪表盘”，并能区分动态/共享连接、Bot 和近期滥用 | Key 出现在标准 URL 中；应仅服务端调用。评分会受 strictness、UA 等输入影响，监控固定 IP 时必须固定查询参数 |
| MaxMind GeoIP Insights / IP Risk | IP 风险、静态/动态倾向、用户数、连接类型、ASN/ISP、VPN/托管/公开代理/住宅代理/Tor | `ip_address.risk` 0.01–99，越高风险越高；`static_ip_score` 0–99.99 是静态/动态指标，不是信誉分 | 最适合判断“是否真静态”、共享程度、住宅代理/托管属性；数据库方案适合批量和隐私敏感部署 | minFraud 顶层 `risk_score` 是交易欺诈概率，不能脱离交易上下文作为 IP 质量；需账户 ID + License Key，HTTPS Basic Auth |
| IPinfo | ASN、ISP、地理、网络类型、VPN、Proxy、Tor、Relay、Hosting，Max 还提供住宅代理活动信号 | 标准隐私 API主要是分类布尔值，并非统一信誉分 | 最适合网络归属、住宅/托管/匿名类型校验；Lite 可免费取得国家和基础 ASN | 隐私检测是付费能力；没有与 IPQS 同义的通用 fraud score，不能虚构转换为“官方评分” |
| AbuseIPDB | 社区攻击举报、报告数量、最近举报时间、Tor、ISP、usage type | `abuseConfidenceScore` 0–100，是基于用户举报计算的滥用置信度，越高越危险 | 适合作为“是否近期被攻击举报”的独立证据，尤其对 VPS/机房 IP 有用 | 不是 Proxy/VPN 专业检测；低报告量不等于安全。官方不提供 CORS，明确要求 Key 不得用于客户端调用 |

Scamalytics 未列入首期 Provider：目前可公开验证的官方资料不足以像上述四家一样完整确认 API 字段、认证和集成约束；在取得正式 API 合同与字段文档前，不应依赖非官方示例实现 Adapter。

## 官方字段与语义

### IPQualityScore

Proxy & VPN Detection API 返回 `fraud_score`、`proxy`、`vpn`、`tor`、`active_vpn`、`active_tor`、`bot_status`、`recent_abuse`、`frequent_abuser`、`high_risk_attacks`、`shared_connection`、`dynamic_connection`、`connection_type` 等信息。官方说明 `fraud_score` 为 0–100；85 以上可疑，90 以上通常代表高风险/恶意行为。Proxy/VPN 的普通风险可能落在 70–75 左右，因此不能简单把“使用 VPN”判为恶意。

标准调用形式把 API Key 放入 URL 路径。官方的自定义集成文档也明确建议安全敏感调用只在服务端完成。固定 IP 周期检测应固定 `strictness` 与 `allow_public_access_points`，否则同一 IP 的分数不可直接比较；没有浏览器 UA 的服务器资产也不应伪造 UA。

官方资料：

- [Proxy & VPN Detection API](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview)
- [Response Parameters](https://www.ipqualityscore.com/documentation/proxy-detection-api/response-parameters)
- [Scoring and Best Practices](https://www.ipqualityscore.com/documentation/proxy-detection-api/best-practices)
- [Server-side security note](https://www.ipqualityscore.com/documentation/integrations/proxy)

### MaxMind

MaxMind 需要区分三个概念：

- `risk_score`：minFraud 顶层交易风险，0.01–99，官方举例说明数值可解释为交易欺诈概率。
- `ip_address.risk`：IP 地址本身风险，0.01–99，越高越危险。
- `traits.static_ip_score`：0–99.99，表示 IP 静态或动态程度的指标；它不是“信誉风险”。

Insights/Factors 的匿名网络字段包括 `is_anonymous`、`is_anonymous_vpn`、`is_hosting_provider`、`is_public_proxy`、`is_residential_proxy`、`is_tor_exit_node`、`network_last_seen`、`provider_name`，另有 `user_count`、连接类型、ASN 和 ISP。对于本项目，优先考虑 GeoIP Insights / IP Risk 数据；只有确有交易风控上下文时才使用 minFraud 顶层风险。

Web Service 使用 HTTPS POST、HTTP Basic Auth，用户名为 account ID、密码为 license key，要求 TLS 1.2+。适合服务端 Adapter；大量固定 IP 可考虑下载数据库并在本地查询，降低延迟与凭据暴露面。

官方资料：

- [minFraud Response API](https://dev.maxmind.com/minfraud/api-documentation/responses/)
- [minFraud Request Authentication](https://dev.maxmind.com/minfraud/api-documentation/requests/)
- [GeoIP IP Risk fields](https://dev.maxmind.com/geoip/docs/databases/ip-risk/binary/)
- [GeoIP/GeoLite field comparison](https://dev.maxmind.com/static/pdf/GeoLite2-and-GeoIP2-Precision-Web-Services-Comparison.pdf)

### IPinfo

IPinfo 的强项是事实型网络画像，而不是单一风险分：ASN/组织、网络类型，以及 `is_proxy`、`is_relay`、`is_tor`、`is_vpn`、`is_res_proxy`、hosting、privacy service name。Max 还提供住宅代理最近观察日期和 7 天内出现比例等行为信号。

Lite 目前对带 Token 的国家与基础 ASN 查询不设请求配额，但 VPN/Proxy/Tor 等隐私检测属于付费能力。认证支持 Bearer、Basic Auth 或 URL Token；生产端建议服务端使用 Bearer Header，不将 Token 放 URL 或主题设置响应中。

官方资料：

- [IPinfo API tiers and schema](https://ipinfo.io/developers/ipinfo-api)
- [Privacy Detection API](https://ipinfo.io/developers/privacy-standard-api)
- [Authentication](https://ipinfo.io/developers)
- [Free tier limits](https://support.ipinfo.io/hc/en-us/articles/30792535492626-What-Is-the-Usage-Limit-for-the-Free-Plan)

### AbuseIPDB

`GET /api/v2/check` 返回 `abuseConfidenceScore`、`totalReports`、`numDistinctUsers`、`lastReportedAt`、`isTor`、`usageType`、ISP 和域名。时间窗由 `maxAgeInDays` 控制，默认 30 天，可配置 1–365 天。应同时保留报告数、独立报告者数和最近时间；单独的 0 分或 0 报告不能证明 IP 安全。

API Key 推荐放 `Key` Header。官方明确不设置 CORS，因为 API Key 是私密凭据且不应由客户端调用。免费 Individual 计划官方当前列出 1,000 次 Check/Report 每日额度；响应头提供 Limit、Remaining、Reset 和 Retry-After，集成必须读取它们并退避。

官方资料：

- [AbuseIPDB API v2](https://docs.abuseipdb.com/)
- [Plans and current limits](https://www.abuseipdb.com/pricing)

## 推荐统一模型

```ts
type IpRiskLevel = 'unknown' | 'low' | 'medium' | 'high' | 'critical'

interface StaticIpQuality {
  // 本项目派生展示分：越高越好；无足够输入时必须为 null。
  qualityScore: number | null
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' | 'unknown'

  // 归一化后的信誉风险：越高越危险。
  reputationRiskScore: number | null
  riskLevel: IpRiskLevel

  classification: {
    proxy: boolean | null
    vpn: boolean | null
    tor: boolean | null
    relay: boolean | null
    hosting: boolean | null
    residentialProxy: boolean | null
    bot: boolean | null
    mobile: boolean | null
    shared: boolean | null
    dynamic: boolean | null
  }

  network: {
    asn?: string
    organization?: string
    isp?: string
    connectionType?: string
    usageType?: string
    privacyService?: string
    staticIpScore?: number
  }

  abuse: {
    recentAbuse: boolean | null
    abuseConfidenceScore?: number
    totalReports?: number
    distinctReporters?: number
    lastReportedAt?: string
  }

  providers: Array<{
    provider: 'ipqualityscore' | 'maxmind' | 'ipinfo' | 'abuseipdb' | string
    checkedAt: string
    rawRiskScore?: number
    rawScoreName?: string
    requestId?: string
    status: 'fresh' | 'stale' | 'partial' | 'error'
  }>

  checkedAt: string | null
  staleAt: string | null
  reasons: Array<{ code: string; severity: IpRiskLevel; label: string }>
}
```

设计规则：

1. `null` 表示未知，绝不能把缺失字段强制转成 `false` 或 `0`。
2. Provider 原始风险分只映射到 `reputationRiskScore`，不覆盖 `qualityScore`。
3. `staticIpScore` 保持独立，因为“动态 IP”不等于“恶意 IP”。
4. 多 Provider 冲突时保留全部 provenance，并在 `reasons` 中说明；不要静默选择更乐观结果。
5. UI 至少显示“检测来源、检测时间、是否过期”，避免把旧情报当实时结果。

## 推荐质量分算法

只有存在足够监测数据时才生成 `qualityScore`。建议初始权重：

```text
qualityScore =
  reputation component  35%
  packet-loss component 25%
  latency component     15%
  availability          15%
  stability             10%
```

- reputation component = `100 - reputationRiskScore`。
- 丢包、延迟需采用一段时间的分位数而不是单次采样。
- Hosting、VPN、住宅代理本身是分类事实，不应固定扣分；是否扣分应由用户选择的使用场景策略决定。
- `recentAbuse`、Bot、Tor 或高置信恶意举报可以进入风险原因，并对安全用途启用硬上限。
- 缺少某项时重新归一化剩余权重；只剩第三方风险分时，UI 应标为“信誉分”，不能称“综合质量分”。

推荐场景策略：

- `residential-egress`：住宅归属、非共享、非动态、低风险权重更高。
- `server-egress`：Hosting 合法，不扣分；更重视滥用历史、稳定性和可用率。
- `streaming`：第三方风险仅作参考，解锁检测另设维度，不能混入信誉分。

## 服务端集成架构

```text
Theme UI
  -> /api/static-ips (无供应商密钥)
      -> StaticIpQualityAggregator
          -> IPQSAdapter
          -> MaxMindAdapter
          -> IPinfoAdapter
          -> AbuseIPDBAdapter
          -> cache / database
```

建议实现约束：

- 凭据只存在服务端环境变量或 Secret Store；主题设置只引用 Provider 配置 ID。
- 每个 Adapter 输出统一模型片段和 provenance，不直接输出 UI 文案。
- 按 IP + Provider + 固定查询参数缓存。信誉数据建议小时级或日级刷新，网络 RT/丢包仍使用 Komari 实时数据。
- 并发查询设置超时、熔断与指数退避；单一 Provider 失败时返回缓存结果并标记 `stale`，不能让 Static IP 卡片整体消失。
- 记录配额响应头，避免 AbuseIPDB 等服务被刷新轮询耗尽。
- 不保存供应商完整原始响应到浏览器；服务端日志对 IP、请求 ID 和错误做必要脱敏。
- 支持 `manual`、`scheduled`、`on-ip-change` 三种检测触发，默认不随每次页面刷新调用付费 API。

## 推荐落地顺序

1. 首先实现 Provider 接口、缓存、provenance 和 `null` 语义。
2. 首个 Adapter 选 IPQS：它最直接提供可展示的 0–100 风险和丰富行为标志。
3. 接入 IPinfo，补充 ASN、ISP、Hosting、VPN/Proxy/Tor/Relay 与住宅代理分类。
4. 接入 AbuseIPDB 作为独立举报维度，而非替代综合信誉源。
5. 对批量、离线或高隐私部署增加 MaxMind GeoIP/IP Risk Adapter；只在有交易上下文时使用 minFraud 交易分。
6. 最后开放策略化 `qualityScore`，并在 UI 同时展示“综合质量”和“第三方信誉风险”，避免语义混淆。

## 主题 v1.5.0 已接入的数据契约

主题仍只读取统一的 `/api/static-ips`，不会从浏览器直连任何评分厂商。每个节点可携带 `quality`，也兼容同名顶层 Provider 数据：

```json
{
  "id": "uk-home-01",
  "name": "UK Home",
  "latency": 80,
  "packetLoss": 0.5,
  "availability": 99.9,
  "quality": {
    "provider": "composite",
    "checkedAt": "2026-09-23T06:30:00Z",
    "ipqs": { "fraud_score": 8, "proxy": false, "vpn": false, "tor": false },
    "ipinfo": { "privacy": { "hosting": false, "residential": false } },
    "abuseipdb": { "data": { "abuseConfidenceScore": 0 } }
  }
}
```

当前兼容 Adapter 会保留来源和原始风险维度，取可用风险证据的最高值作为保守的 `reputationRiskScore`。综合质量分按可用项重新归一化：信誉 45%、延迟 20%、丢包 20%、可用率 15%。显式提供的 `quality.score` 优先，便于后续把更成熟的服务端历史分位数算法无损接入。
