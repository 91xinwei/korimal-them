export type NodeStatus = "online" | "offline" | "warning";

export type NetworkNodeType = "vps" | "static";

export interface BaseNode {
  id: string;
  name: string;
  type: NetworkNodeType;
  country: string;
  countryCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  ipv4?: string;
  ipv6?: string;
  status: NodeStatus;
  latency?: number;
  packetLoss?: number;
  updatedAt?: string;
  monthlyPrice?: number;
  currency?: string;
}

export interface VpsNode extends BaseNode {
  type: "vps";
  cpuPercent?: number;
  cpuCores?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  diskUsedGB?: number;
  diskTotalGB?: number;
  load?: number;
  uploadSpeedKB?: number;
  downloadSpeedKB?: number;
  trafficOutGB?: number;
  trafficInGB?: number;
  trafficUsedGB?: number;
  trafficLimitGB?: number;
  trafficResetDays?: number;
  tcpConnections?: number;
  udpConnections?: number;
  telecomLatency?: number;
  telecomLoss?: number;
  unicomLatency?: number;
  unicomLoss?: number;
  mobileLatency?: number;
  mobileLoss?: number;
  uptimeDays?: number;
  expireDays?: number;
  billingCycleDays?: number;
}

export type StaticIpCategory =
  | "residential"
  | "isp"
  | "static-home"
  | "datacenter"
  | "unknown";

export type StaticIpProtocol = "http" | "https" | "socks5";

export interface StaticIpUnlock {
  chatgpt?: boolean | null;
  claude?: boolean | null;
  google?: boolean | null;
  netflix?: boolean | null;
  disney?: boolean | null;
  youtubePremium?: boolean | null;
}

export interface StaticIpNode extends BaseNode {
  type: "static";
  isp?: string;
  asn?: string;
  ipCategory?: StaticIpCategory;
  protocol?: StaticIpProtocol;
  availability?: number;
  riskScore?: number;
  proxyDetected?: boolean;
  hostingDetected?: boolean;
  vpnDetected?: boolean;
  unlock?: StaticIpUnlock;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  billingCycleDays?: number;
}

export type NetworkAssetNode = VpsNode | StaticIpNode;

export type NodeTypeFilter = "all" | "vps" | "static" | "warning";
