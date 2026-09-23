# VPS IP Quality 每日检测服务

主题不能安全保存供应商 API Key，因此仓库提供 `scripts/ip-quality-service.mjs` 作为同机服务。它按 Komari 节点 UUID 关联公网 IP，默认每 24 小时查询一次并写入本地缓存；页面刷新只读取缓存，不会重复消耗供应商额度。

主题 v1.5.4 自带 `/data/static-ips.json` 静态订阅清单，可直接显示已提供的 Comcast、Astound 和 Glide 三个节点。IP 质量分仍需要本服务至少接入一个真实评分 Provider；未配置时卡片会显示“待检测”。Glide 尚未提供 IPv4，补齐地址后才能检测该节点。

## 配置

1. 复制 `ip-quality-targets.example.json` 为服务器上的 `ip-quality-targets.json`。
2. 将 `id` 填为 Komari 节点 UUID，将 `ip` 填为该 VPS 的公网出口 IP。官方公开节点接口会隐藏 IP，因此脚本不会绕过权限自动读取私密字段。
3. 至少配置一个 Provider Key：

```bash
export IPQS_API_KEY="..."
export IPINFO_TOKEN="..."
export ABUSEIPDB_API_KEY="..."
export IP_QUALITY_TARGETS_FILE="/opt/komari-theme/ip-quality-targets.json"
export IP_QUALITY_CACHE_FILE="/var/lib/komari-ip-quality/cache.json"
export IP_QUALITY_REFRESH_MS="86400000"
node /opt/komari-theme/scripts/ip-quality-service.mjs
```

服务只监听 `127.0.0.1:8787`。使用 Nginx/Caddy 将 `/api/ip-quality` 反向代理到该地址，然后在“主题设置 → 网络资产与 Static IP”中保持 VPS IP Quality API URL 为 `/api/ip-quality`。

## systemd 示例

```ini
[Unit]
Description=Komari IP Quality Daily Cache
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/komari-theme
EnvironmentFile=/etc/komari-ip-quality.env
ExecStart=/usr/bin/node /opt/komari-theme/scripts/ip-quality-service.mjs
Restart=on-failure
User=komari

[Install]
WantedBy=multi-user.target
```

密钥只应写入权限为 `0600` 的 `/etc/komari-ip-quality.env`，不要放入主题设置、目标 JSON、Git 或浏览器环境变量。
