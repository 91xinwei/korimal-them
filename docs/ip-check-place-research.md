# IP.Check.Place 接入调研

调研日期：2026-09-23。对象是 [xykt/IPQuality](https://github.com/xykt/IPQuality) 项目的 `bash <(curl -sL https://IP.Check.Place)` 脚本；下文只依据项目自有 README、脚本和示例输出，以及数据供应商官方文档。

## 结论

可以用它给**脚本实际使用的出口 IP** 定期生成质量报告，并将 JSON 结果转换为本主题的 IP Quality 数据。它不适合在 Komari 主题的浏览器端运行。对于 Comcast、Astound、Glide 等静态 IP，只有检测任务确实通过对应 IP 的网卡或代理出站，媒体解锁、邮件连通性等网络实测才与该 IP 对应。脚本没有“传入任意目标 IP 即完整检测”的公开命令参数：`getopts` 只接收 `-i` 网卡、`-x` 代理等选项，传入的普通位置参数没有被解析；默认 IPv4 是通过一组“我的 IP”服务获取的。[README 使用方法](https://github.com/xykt/IPQuality/blob/main/README.md)、[脚本选项和入口](https://github.com/xykt/IPQuality/blob/main/ip.sh)

脚本内部调用 `https://ipinfo.check.place/$IP?db=...` 查询部分数据库；这是从源码观察到的内部接口，README 没有承诺它是供第三方长期调用的公开 API，也没有公布鉴权、限额或稳定性契约。不建议将该地址硬编码进生产主题。需要查询**任意已知 IP** 时，使用有正式文档的 [IPQS Proxy Detection API](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview)、[AbuseIPDB API](https://www.abuseipdb.com/api) 或 [IPinfo API](https://ipinfo.io/developers/ipinfo-api) 更可靠。

## 已确认的能力和数据格式

| 项目 | 官方源码或文档结论 |
| --- | --- |
| 出口选择 | 默认自动检测 IPv4/IPv6 出口；`-i eth0` 指定网卡，`-x http(s)://...` 或 `-x socks5://...` 指定代理。[README](https://github.com/xykt/IPQuality/blob/main/README.md)、[ip.sh](https://github.com/xykt/IPQuality/blob/main/ip.sh) |
| 机器可读输出 | `-j` 在标准输出给出 JSON；`-o /path/to/file.json` 写入文件；`-p` 禁止生成在线报告链接；`-f` 让报告显示完整 IP。[README](https://github.com/xykt/IPQuality/blob/main/README.md) |
| 风险分 | 示例 JSON 的 `Score` 分别包含 `IP2LOCATION`、`SCAMALYTICS`、`ipapi`、`AbuseIPDB`、`IPQS`、`DBIP`，它们是**各来源独立风险分**，不是统一质量分。数值常以字符串给出，`ipapi` 带百分号，缺失值可能为字符串 `"null"`。`Factor` 按来源列出 Proxy/Tor/VPN/Server/Abuser/Robot。[官方输出样例](https://github.com/xykt/IPQuality/blob/main/res/output.json) |
| 网络实测 | 包含流媒体和 AI 服务解锁、邮件 25 端口与 DNSBL 测试，这些依赖运行地点和出站路径，不能等同于离线 IP 数据库查询。[README](https://github.com/xykt/IPQuality/blob/main/README.md)、[ip.sh](https://github.com/xykt/IPQuality/blob/main/ip.sh) |
| 许可 | 项目仓库声明 [AGPL-3.0](https://github.com/xykt/IPQuality/blob/main/LICENSE)。若要把脚本源码打包、修改并作为网络服务提供，需要单独审视相应许可义务；只执行上游脚本并转换结果与复制其代码不同。 |

当前 `ip.sh` 的 JSON 生成段把 `Score.IPQS` 写成 `${ipapi[ipqs]}`，而实际 IPQS 查询设置的是 `${ipqs[score]}`。因此当前版本即使 IPQS 查询成功，JSON 的 `Score.IPQS` 也可能是 `"null"`；不能把该字段的缺失直接判定为供应商无评分。[ip.sh 的 `db_ipqs` 与 `save_json`](https://github.com/xykt/IPQuality/blob/main/ip.sh)

## 对 Komari 的合适集成方式

1. 在被检测 VPS 或具备指定代理出口的服务器上，由系统定时任务每日运行一次脚本，使用 `-4 -j -p -f`；如需指定出口，再加 `-i` 或 `-x`。首次先核对 `Head.IP` 是否等于预期目标，避免给静态 IP 卡片错配结果。脚本需要联网和本机依赖，不能在浏览器执行。[README](https://github.com/xykt/IPQuality/blob/main/README.md)
2. 在服务器端验证 JSON 的 `Head.IP`、时间、来源分数及布尔字段，再转换为现有统一 IP Quality 模型。保留每个来源的风险分及采集时间；如要显示单一 `0–100` 质量分，应明确这是本主题的合成值，不能标称为 IP.Check.Place 官方总分。[输出样例](https://github.com/xykt/IPQuality/blob/main/res/output.json)
3. 定时任务失败时保留上次成功结果，并在卡片显示检测时间和过期状态。公开主题接口只返回展示所需字段，不暴露代理凭据或完整原始报告。
4. 若静态 IP 只是一个订阅记录，既没有对应机器也没有可用的代理出口，则可以通过正式供应商 API 查询该 IP 的**信誉与分类**，但不能把从其他机器跑出的解锁和出站测试算作该 IP 的结果。[IPQS](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview)、[AbuseIPDB](https://www.abuseipdb.com/api)、[IPinfo](https://ipinfo.io/developers/ipinfo-api)

生产部署时应固定经过审阅的上游脚本版本、限制定时任务权限，并在执行前检查脚本及其进一步下载的资源；直接每日运行 `bash <(curl ...)` 会让远端代码变动即时进入服务器。脚本默认可能生成在线报告，`-p` 可禁用。[README 隐私模式](https://github.com/xykt/IPQuality/blob/main/README.md)、[脚本资源读取与报告上传](https://github.com/xykt/IPQuality/blob/main/ip.sh)
