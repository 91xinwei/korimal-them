import { Braces, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import type { NodeDisplay } from "@/types/komari";
import { getPingMiniSnapshot } from "@/hooks/usePingMini";
import { exportSnapshotCsv, exportSnapshotJson } from "@/services/snapshot";
import { formatBytes } from "@/utils/format";

export function SnapshotExportPanel({ nodes }: { nodes: NodeDisplay[] }) {
  const rows = nodes.map((node) => ({ node, ping: getPingMiniSnapshot(node.uuid) }));
  const online = nodes.filter((node) => node.online === true).length;
  const memory = nodes.reduce((sum, node) => sum + Math.max(0, node.ramTotal), 0);
  const disk = nodes.reduce((sum, node) => sum + Math.max(0, node.diskTotal), 0);

  return (
    <section className="operations-panel snapshot-export-panel" aria-label="节点快照导出">
      <div className="operations-panel-head">
        <div>
          <div className="operations-panel-title"><Download size={17} />JSON / CSV 节点快照</div>
          <p>导出当前搜索和快捷筛选后的可见节点，不包含 Cookie、Token 或管理员密钥。</p>
        </div>
        <div className="snapshot-export-actions">
          <button type="button" onClick={() => exportSnapshotJson(rows)} disabled={nodes.length === 0}>
            <Braces size={14} />导出 JSON
          </button>
          <button type="button" onClick={() => exportSnapshotCsv(rows)} disabled={nodes.length === 0}>
            <FileSpreadsheet size={14} />导出 CSV
          </button>
        </div>
      </div>

      <div className="snapshot-summary-grid">
        <div><span>导出节点</span><strong>{nodes.length}</strong><small>台</small></div>
        <div><span>当前在线</span><strong>{online}</strong><small>台</small></div>
        <div><span>总内存</span><strong>{formatBytes(memory)}</strong></div>
        <div><span>总硬盘</span><strong>{formatBytes(disk)}</strong></div>
      </div>

      <div className="snapshot-security-note">
        <ShieldCheck size={16} />
        <span>CSV 已处理公式注入和双引号/换行转义，并带 UTF-8 BOM，可直接使用 Excel 打开。</span>
      </div>

      <div className="snapshot-preview-list">
        {nodes.slice(0, 8).map((node) => (
          <div key={node.uuid}>
            <span className="snapshot-node-status" data-online={node.online === true ? "true" : "false"} />
            <strong title={node.name}>{node.name}</strong>
            <span>{node.region || "未知地区"}</span>
            <span className="tabular">CPU {node.cpuPct.toFixed(1)}%</span>
            <span className="tabular">内存 {node.ramPct.toFixed(1)}%</span>
          </div>
        ))}
        {nodes.length > 8 && <div className="snapshot-more">其余 {nodes.length - 8} 台会包含在导出文件中</div>}
      </div>
    </section>
  );
}
