import { useMemo, useState } from "react";
import { AlertOctagon, Boxes, GitBranch, Network, Server } from "lucide-react";
import type { NodeDisplay } from "@/types/komari";
import { Flag } from "@/components/ui/Flag";
import { parseTags } from "@/utils/format";
import { getRegionDisplayName } from "@/utils/region";

type TopologyMode = "groups" | "links" | "causes";

function normalizeRef(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function upstreamRefs(node: NodeDisplay) {
  return parseTags(node.tags)
    .map((tag) => tag.label.match(/^(?:upstream|parent|上游|入口)\s*[:：=]\s*(.+)$/i)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

export function NodeTopologyPanel({ nodes }: { nodes: NodeDisplay[] }) {
  const [mode, setMode] = useState<TopologyMode>("groups");
  const topology = useMemo(() => {
    const lookup = new Map<string, NodeDisplay>();
    for (const node of nodes) {
      lookup.set(normalizeRef(node.uuid), node);
      lookup.set(normalizeRef(node.name), node);
    }

    const links = nodes.flatMap((node) => upstreamRefs(node).map((reference) => ({
      node,
      reference,
      upstream: lookup.get(normalizeRef(reference)) ?? null,
    })));
    const groupMap = new Map<string, NodeDisplay[]>();
    const regionMap = new Map<string, NodeDisplay[]>();
    for (const node of nodes) {
      const group = node.group?.trim() || "未分组";
      const groupNodes = groupMap.get(group) ?? [];
      groupNodes.push(node);
      groupMap.set(group, groupNodes);
      const region = node.region?.trim() || "未知地区";
      const regionNodes = regionMap.get(region) ?? [];
      regionNodes.push(node);
      regionMap.set(region, regionNodes);
    }
    const groups = [...groupMap.entries()]
      .map(([name, items]) => ({ name, nodes: items, offline: items.filter((node) => node.online === false) }))
      .sort((left, right) => right.nodes.length - left.nodes.length);
    const causes: Array<{
      id: string;
      title: string;
      description: string;
      severity: "danger" | "warn" | "info";
      nodes: NodeDisplay[];
    }> = [];

    for (const link of links) {
      if (!link.upstream || link.upstream.online !== false) continue;
      const affected = links
        .filter((item) => item.upstream?.uuid === link.upstream?.uuid)
        .map((item) => item.node);
      if (causes.some((cause) => cause.id === `upstream-${link.upstream?.uuid}`)) continue;
      causes.push({
        id: `upstream-${link.upstream.uuid}`,
        title: `${link.upstream.name} 上游异常`,
        description: `${affected.length} 台下游关联该离线入口，建议先检查入口、反代或中转线路。`,
        severity: "danger",
        nodes: affected,
      });
    }
    for (const group of groups) {
      if (group.offline.length < 2) continue;
      causes.push({
        id: `group-${group.name}`,
        title: `${group.name} 集中离线`,
        description: `${group.offline.length}/${group.nodes.length} 台节点离线，可能是同一业务组、宿主机或上游故障。`,
        severity: group.offline.length === group.nodes.length ? "danger" : "warn",
        nodes: group.offline,
      });
    }
    for (const [region, items] of regionMap) {
      const offline = items.filter((node) => node.online === false);
      if (offline.length < 2) continue;
      causes.push({
        id: `region-${region}`,
        title: `${getRegionDisplayName(region)} 区域异常`,
        description: `${offline.length} 台同地区节点离线，可能存在机房、运营商或区域线路问题。`,
        severity: offline.length === items.length ? "danger" : "warn",
        nodes: offline,
      });
    }
    const messageNodes = nodes.filter((node) => node.message.trim());
    if (messageNodes.length > 1) {
      causes.push({
        id: "probe-messages",
        title: "探针消息集中出现",
        description: `${messageNodes.length} 台节点同时报告 message，建议检查 Agent 状态和近期配置变更。`,
        severity: "info",
        nodes: messageNodes,
      });
    }

    return { groups, links, causes };
  }, [nodes]);

  return (
    <section className="operations-panel topology-panel" aria-label="节点拓扑">
      <div className="operations-panel-head">
        <div>
          <div className="operations-panel-title"><Network size={17} />节点拓扑与共同故障分析</div>
          <p>按分组、显式上游标签和地区聚合当前可见节点。</p>
        </div>
        <div className="operations-mode-tabs" role="tablist">
          {([
            ["groups", "分组拓扑", Boxes],
            ["links", "上下游", GitBranch],
            ["causes", "共同故障", AlertOctagon],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" data-active={mode === id ? "true" : "false"} onClick={() => setMode(id)}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {mode === "groups" && (
        <div className="topology-group-grid">
          {topology.groups.map((group) => (
            <div key={group.name} className="topology-group">
              <div className="topology-group-head">
                <span><Boxes size={14} />{group.name}</span>
                <span className="tabular">{group.nodes.length - group.offline.length}/{group.nodes.length}</span>
              </div>
              <div className="topology-node-cloud">
                {group.nodes.map((node) => (
                  <span key={node.uuid} data-online={node.online === true ? "true" : "false"} title={`${node.name} · ${node.online === true ? "在线" : "离线"}`}>
                    <Flag region={node.region} size={11} />{node.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "links" && (
        topology.links.length > 0 ? (
          <div className="topology-link-list">
            {topology.links.map((link, index) => (
              <div key={`${link.node.uuid}-${link.reference}-${index}`} className="topology-link-row">
                <span className="topology-link-node"><Server size={14} />{link.upstream?.name ?? link.reference}</span>
                <span className="topology-link-line"><i /><GitBranch size={13} /><i /></span>
                <span className="topology-link-node"><Flag region={link.node.region} size={11} />{link.node.name}</span>
                <span data-online={link.upstream?.online === true && link.node.online === true ? "true" : "false"}>
                  {link.upstream ? "已识别" : "外部上游"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="operations-empty">节点标签中还没有 `upstream:节点名` 或 `上游:节点名` 关系。</div>
        )
      )}

      {mode === "causes" && (
        topology.causes.length > 0 ? (
          <div className="topology-cause-list">
            {topology.causes.map((cause) => (
              <div key={cause.id} className="topology-cause" data-severity={cause.severity}>
                <AlertOctagon size={18} />
                <div><strong>{cause.title}</strong><p>{cause.description}</p>
                  <div>{cause.nodes.slice(0, 8).map((node) => <span key={node.uuid}>{node.name}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="operations-empty">当前没有发现多节点共同故障特征。</div>
      )}
    </section>
  );
}
