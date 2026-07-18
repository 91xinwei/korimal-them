import { getRpc2Client } from "@/services/rpc2Client";
import type {
  LoadRecord,
  LoadRecordsResponse,
  PingRecord,
  PingRecordsResponse,
  PingTask,
} from "@/types/komari";

type JsonRecord = Record<string, unknown>;

interface MetricPoint {
  time: string;
  value: number | null;
  count: number;
  tags: JsonRecord;
}

interface MetricSeries {
  metricKey: string;
  entityId: string;
  tags: JsonRecord;
  points: MetricPoint[];
}

interface PingMetricStat {
  entityId: string;
  taskId: number;
  name: string;
  interval: number;
  total: number;
  valid: number;
  loss: number;
  lossApproximate: boolean;
  avg: number | null;
  latest: number | null;
  p50: number | null;
  p99: number | null;
  stddev: number | null;
}

export interface MetricHealthSummary {
  cpuPeak: number | null;
  memoryPeak: number | null;
  diskPeak: number | null;
  avgLatency: number | null;
  avgLoss: number | null;
  volatility: number | null;
}

export interface MetricPingOverview {
  count: number;
  records: PingRecord[];
  tasks: PingTask[];
  basicInfo: Array<{
    client: string;
    loss: number;
    min: number;
    max: number;
  }>;
}

const LOAD_METRIC_KEYS = [
  "cpu.usage",
  "load.average",
  "memory.used",
  "memory.total",
  "swap.used",
  "swap.total",
  "temperature",
  "disk.used",
  "disk.total",
  "net.in.rate",
  "net.out.rate",
  "net.total.down",
  "net.total.up",
  "traffic.down",
  "traffic.up",
  "process.count",
  "connections.tcp",
  "connections.udp",
] as const;

const HEALTH_METRIC_KEYS = [
  "cpu.usage",
  "memory.used",
  "memory.total",
  "disk.used",
  "disk.total",
] as const;

const PING_METRIC_KEYS = ["ping.latency_ms", "ping.loss"] as const;
const METRIC_CACHE_TTL_MS = 60_000;
const METRIC_QUERY_TIMEOUT_MS = 60_000;
const METRIC_HISTORY_MAX_POINTS = 720;

let metricDefinitionCache:
  | { expiresAt: number; keys: Set<string> }
  | null = null;
let metricDefinitionPromise: Promise<Set<string>> | null = null;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asPositiveInteger(value: unknown, fallback = 0): number {
  const numeric = asFiniteNumber(value);
  return numeric == null ? fallback : Math.max(0, Math.floor(numeric));
}

function normalizeHours(hours: number) {
  return Number.isFinite(hours) && hours > 0 ? Math.max(1, Math.floor(hours)) : 1;
}

function normalizeTags(...values: unknown[]): JsonRecord {
  return Object.assign({}, ...values.map(asRecord));
}

function normalizeMetricPoint(value: unknown, inheritedTags: JsonRecord): MetricPoint | null {
  const record = asRecord(value);
  const time = asString(record.time ?? record.timestamp);
  if (!time) return null;

  return {
    time,
    value: record.value == null ? null : asFiniteNumber(record.value),
    count: Math.max(1, asPositiveInteger(record.count, 1)),
    tags: normalizeTags(inheritedTags, record.tags, record.tag, record.labels),
  };
}

function normalizeMetricSeries(value: unknown): MetricSeries | null {
  const record = asRecord(value);
  const metricKey = asString(record.metric_key ?? record.metricKey ?? record.name);
  const entityId = asString(record.entity_id ?? record.entityId ?? record.client);
  if (!metricKey || !entityId) return null;
  const tags = normalizeTags(record.tags, record.tag, record.labels);
  const points = asArray(record.points)
    .map((point) => normalizeMetricPoint(point, tags))
    .filter((point): point is MetricPoint => Boolean(point))
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time));

  return { metricKey, entityId, tags, points };
}

function normalizeMetricResponse(value: unknown): MetricSeries[] {
  const record = asRecord(value);
  return asArray(record.series)
    .map(normalizeMetricSeries)
    .filter((series): series is MetricSeries => Boolean(series));
}

async function loadMetricDefinitions(): Promise<Set<string>> {
  const now = Date.now();
  if (metricDefinitionCache && metricDefinitionCache.expiresAt > now) {
    return metricDefinitionCache.keys;
  }
  if (metricDefinitionPromise) return metricDefinitionPromise;

  metricDefinitionPromise = getRpc2Client()
    .call("public:listMetricDefinitions", {}, { timeout: 15_000 })
    .then((payload) => {
      const keys = new Set(
        asArray(payload)
          .map((item) => {
            const record = asRecord(item);
            return asString(record.name ?? record.metric_key ?? record.key);
          })
          .filter(Boolean),
      );
      metricDefinitionCache = {
        expiresAt: Date.now() + METRIC_CACHE_TTL_MS,
        keys,
      };
      return keys;
    })
    .finally(() => {
      metricDefinitionPromise = null;
    });

  return metricDefinitionPromise;
}

async function queryMetrics(
  metricKeys: readonly string[],
  params: JsonRecord,
): Promise<MetricSeries[]> {
  const available = await loadMetricDefinitions();
  const selected = metricKeys.filter((key) => available.has(key));
  if (selected.length === 0) return [];

  const requestedPoints = asPositiveInteger(params.max_points, METRIC_HISTORY_MAX_POINTS);
  const payload = await getRpc2Client().call(
    "public:queryMetrics",
    {
      ...params,
      metric_keys: selected,
      downsample: true,
      fill_empty: true,
      max_points: Math.max(24, Math.min(2_000, requestedPoints)),
      aggregation: "avg",
    },
    { timeout: METRIC_QUERY_TIMEOUT_MS },
  );
  return normalizeMetricResponse(payload);
}

async function loadPublicPingTasksMetric(): Promise<PingTask[]> {
  const payload = await getRpc2Client().call(
    "public:getPublicPingTasks",
    {},
    { timeout: 15_000 },
  );
  return asArray(payload)
    .map((item) => {
      const record = asRecord(item);
      const id = asPositiveInteger(record.id ?? record.task_id, -1);
      if (id < 0) return null;
      return {
        id,
        interval: Math.max(1, asPositiveInteger(record.interval, 60)),
        name: asString(record.name) || `任务 #${id}`,
        loss: Math.max(0, asFiniteNumber(record.loss) ?? 0),
        clients: asArray(record.clients).map(asString).filter(Boolean),
        type: asString(record.type) || "icmp",
        target: asString(record.target),
        weight: asFiniteNumber(record.weight) ?? id,
      } satisfies PingTask;
    })
    .filter((task): task is PingTask => Boolean(task));
}

function normalizePingStats(value: unknown): PingMetricStat[] {
  const record = asRecord(value);
  return asArray(record.stats)
    .map((item) => {
      const stat = asRecord(item);
      const entityId = asString(stat.entity_id ?? stat.entityId ?? stat.client);
      const taskId = asPositiveInteger(stat.task_id ?? stat.taskId, -1);
      if (!entityId || taskId < 0) return null;
      return {
        entityId,
        taskId,
        name: asString(stat.name) || `任务 #${taskId}`,
        interval: Math.max(1, asPositiveInteger(stat.interval, 60)),
        total: asPositiveInteger(stat.total),
        valid: asPositiveInteger(stat.valid),
        loss: Math.max(0, asFiniteNumber(stat.loss) ?? 0),
        lossApproximate: stat.loss_approximate === true,
        avg: asFiniteNumber(stat.avg),
        latest: asFiniteNumber(stat.latest),
        p50: asFiniteNumber(stat.p50),
        p99: asFiniteNumber(stat.p99),
        stddev: asFiniteNumber(stat.stddev),
      } satisfies PingMetricStat;
    })
    .filter((stat): stat is PingMetricStat => Boolean(stat));
}

async function loadPingStats(params: JsonRecord): Promise<PingMetricStat[]> {
  const payload = await getRpc2Client().call(
    "public:getPingMetricStats",
    params,
    { timeout: METRIC_QUERY_TIMEOUT_MS },
  );
  return normalizePingStats(payload);
}

function metricTaskId(series: MetricSeries, point?: MetricPoint): number {
  const tags = normalizeTags(series.tags, point?.tags);
  return asPositiveInteger(tags.task_id ?? tags.task ?? tags.id, -1);
}

function createTaskMap(tasks: PingTask[], stats: PingMetricStat[], series: MetricSeries[]) {
  const map = new Map<number, PingTask>();
  for (const task of tasks) map.set(task.id, task);
  for (const stat of stats) {
    const previous = map.get(stat.taskId);
    map.set(stat.taskId, {
      id: stat.taskId,
      interval: previous?.interval ?? stat.interval,
      name: previous?.name || stat.name,
      loss: stat.loss,
      clients: previous?.clients ?? [],
      type: previous?.type ?? "icmp",
      target: previous?.target ?? "",
      weight: previous?.weight ?? stat.taskId,
    });
  }
  for (const item of series) {
    const taskId = metricTaskId(item);
    if (taskId < 0 || map.has(taskId)) continue;
    map.set(taskId, {
      id: taskId,
      interval: 60,
      name: `任务 #${taskId}`,
      loss: 0,
      clients: [],
      type: "icmp",
      target: "",
      weight: taskId,
    });
  }
  return map;
}

function buildMetricPingRecords(
  series: MetricSeries[],
  stats: PingMetricStat[],
  overviewMode: boolean,
): PingRecord[] {
  const records: PingRecord[] = [];
  const positiveCount = new Map<string, number>();
  const latestValue = new Map<string, number>();

  for (const item of series) {
    if (item.metricKey !== "ping.latency_ms") continue;
    for (const point of item.points) {
      const taskId = metricTaskId(item, point);
      if (taskId < 0 || point.value == null || point.value < 0) continue;
      const key = `${item.entityId}:${taskId}`;
      positiveCount.set(key, (positiveCount.get(key) ?? 0) + 1);
      latestValue.set(key, point.value);
      records.push({
        client: item.entityId,
        task_id: taskId,
        time: point.time,
        value: point.value,
      });
    }
  }

  if (!overviewMode) {
    for (const item of series) {
      if (item.metricKey !== "ping.loss") continue;
      for (const point of item.points) {
        const taskId = metricTaskId(item, point);
        if (taskId < 0 || point.value == null || point.value < 0.999) continue;
        records.push({
          client: item.entityId,
          task_id: taskId,
          time: point.time,
          value: -1,
        });
      }
    }
  }

  const endTime = Date.now();
  for (const stat of stats) {
    const key = `${stat.entityId}:${stat.taskId}`;
    let validSamples = positiveCount.get(key) ?? 0;
    const fallbackLatency = stat.latest ?? stat.avg ?? 1;
    if (validSamples === 0 && stat.valid > 0) {
      records.push({
        client: stat.entityId,
        task_id: stat.taskId,
        time: endTime,
        value: fallbackLatency,
      });
      validSamples = 1;
    }

    if (!overviewMode || stat.lossApproximate || stat.loss <= 0) continue;
    const lostSamples = stat.loss >= 100
      ? Math.max(1, Math.min(20, stat.total || 20))
      : Math.min(40, Math.max(0, Math.round((validSamples * stat.loss) / (100 - stat.loss))));
    for (let index = 0; index < lostSamples; index += 1) {
      records.push({
        client: stat.entityId,
        task_id: stat.taskId,
        time: endTime - (lostSamples - index) * 2,
        value: -1,
      });
    }
    if (!latestValue.has(key) && validSamples > 0) latestValue.set(key, fallbackLatency);
  }

  return records.sort((left, right) => {
    const leftTime = typeof left.time === "number" ? left.time : Date.parse(left.time);
    const rightTime = typeof right.time === "number" ? right.time : Date.parse(right.time);
    return leftTime - rightTime;
  });
}

async function loadMetricPingData(
  hours: number,
  options: { uuid?: string; taskId?: number; overviewMode?: boolean } = {},
) {
  const safeHours = normalizeHours(hours);
  const params: JsonRecord = { hours: safeHours };
  params.max_points = options.overviewMode ? 120 : METRIC_HISTORY_MAX_POINTS;
  if (options.uuid) params.entity_id = options.uuid;
  if (options.taskId != null) params.tags = { task_id: String(options.taskId) };

  const [series, tasks, stats] = await Promise.all([
    queryMetrics(PING_METRIC_KEYS, params),
    loadPublicPingTasksMetric().catch(() => []),
    loadPingStats({
      hours: safeHours,
      ...(options.uuid ? { entity_id: options.uuid } : {}),
      ...(options.taskId != null ? { task_id: options.taskId } : {}),
    }).catch(() => []),
  ]);
  const filteredSeries = options.taskId == null
    ? series
    : series.filter((item) =>
        metricTaskId(item) === options.taskId ||
        item.points.some((point) => metricTaskId(item, point) === options.taskId));
  const filteredStats = options.taskId == null
    ? stats
    : stats.filter((item) => item.taskId === options.taskId);
  const taskMap = createTaskMap(tasks, filteredStats, filteredSeries);
  const records = buildMetricPingRecords(
    filteredSeries,
    filteredStats,
    options.overviewMode === true,
  );
  return {
    records,
    tasks: [...taskMap.values()].sort((left, right) => left.weight - right.weight),
    stats: filteredStats,
  };
}

export async function loadMetricLoadRecords(
  uuid: string,
  hours: number,
): Promise<LoadRecordsResponse | null> {
  const series = await queryMetrics(LOAD_METRIC_KEYS, {
    entity_id: uuid,
    hours: normalizeHours(hours),
  });
  if (series.length === 0) return null;

  const rows = new Map<string, LoadRecord>();
  const ensureRow = (time: string) => {
    const existing = rows.get(time);
    if (existing) return existing;
    const row: LoadRecord = {
      client: uuid,
      time,
      cpu: 0,
      gpu: 0,
      ram: 0,
      ram_total: 0,
      swap: 0,
      swap_total: 0,
      load: 0,
      temp: 0,
      disk: 0,
      disk_total: 0,
      net_in: 0,
      net_out: 0,
      net_total_up: 0,
      net_total_down: 0,
      process: 0,
      connections: 0,
      connections_udp: 0,
    };
    rows.set(time, row);
    return row;
  };

  for (const item of series) {
    for (const point of item.points) {
      if (point.value == null) continue;
      const row = ensureRow(point.time);
      switch (item.metricKey) {
        case "cpu.usage": row.cpu = point.value; break;
        case "load.average": row.load = point.value; break;
        case "memory.used": row.ram = point.value; break;
        case "memory.total": row.ram_total = point.value; break;
        case "swap.used": row.swap = point.value; break;
        case "swap.total": row.swap_total = point.value; break;
        case "temperature": row.temp = point.value; break;
        case "disk.used": row.disk = point.value; break;
        case "disk.total": row.disk_total = point.value; break;
        case "net.in.rate": row.net_in = point.value; break;
        case "net.out.rate": row.net_out = point.value; break;
        case "net.total.down": row.net_total_down = point.value; break;
        case "net.total.up": row.net_total_up = point.value; break;
        case "process.count": row.process = point.value; break;
        case "connections.tcp": row.connections = point.value; break;
        case "connections.udp": row.connections_udp = point.value; break;
      }
    }
  }

  const records = [...rows.values()].sort(
    (left, right) => Date.parse(String(left.time)) - Date.parse(String(right.time)),
  );
  return records.length > 0 ? { count: records.length, records } : null;
}

export async function loadMetricPingRecords(
  uuid: string,
  hours: number,
): Promise<PingRecordsResponse | null> {
  const result = await loadMetricPingData(hours, { uuid });
  if (result.records.length === 0 && result.stats.length === 0) return null;
  return {
    count: result.records.length,
    records: result.records,
    tasks: result.tasks,
  };
}

export async function loadMetricPingOverview(
  hours: number,
  taskId?: number,
): Promise<MetricPingOverview | null> {
  const result = await loadMetricPingData(hours, {
    taskId,
    overviewMode: true,
  });
  if (result.records.length === 0 && result.stats.length === 0) return null;
  return {
    count: result.records.length,
    records: result.records,
    tasks: result.tasks,
    basicInfo: result.stats.map((stat) => ({
      client: stat.entityId,
      loss: stat.loss,
      min: stat.p50 ?? stat.avg ?? 0,
      max: stat.p99 ?? stat.latest ?? stat.avg ?? 0,
    })),
  };
}

export async function loadMetricHealthSummaries(
  uuids: string[],
  hours: number,
): Promise<Map<string, MetricHealthSummary>> {
  if (uuids.length === 0) return new Map();
  const safeHours = normalizeHours(hours);
  const [series, pingStats] = await Promise.all([
    queryMetrics(HEALTH_METRIC_KEYS, {
      entity_ids: uuids,
      hours: safeHours,
      max_points: 240,
    }),
    loadPingStats({ entity_ids: uuids, hours: safeHours }).catch(() => []),
  ]);

  const summaries = new Map<string, MetricHealthSummary>();
  const ensureSummary = (uuid: string) => {
    const current = summaries.get(uuid);
    if (current) return current;
    const created: MetricHealthSummary = {
      cpuPeak: null,
      memoryPeak: null,
      diskPeak: null,
      avgLatency: null,
      avgLoss: null,
      volatility: null,
    };
    summaries.set(uuid, created);
    return created;
  };
  const memoryUsed = new Map<string, number>();
  const memoryTotal = new Map<string, number>();
  const diskUsed = new Map<string, number>();
  const diskTotal = new Map<string, number>();

  for (const item of series) {
    if (!uuids.includes(item.entityId)) continue;
    const values = item.points
      .map((point) => point.value)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) continue;
    const maximum = Math.max(...values);
    const summary = ensureSummary(item.entityId);
    if (item.metricKey === "cpu.usage") summary.cpuPeak = maximum;
    if (item.metricKey === "memory.used") memoryUsed.set(item.entityId, maximum);
    if (item.metricKey === "memory.total") memoryTotal.set(item.entityId, maximum);
    if (item.metricKey === "disk.used") diskUsed.set(item.entityId, maximum);
    if (item.metricKey === "disk.total") diskTotal.set(item.entityId, maximum);
  }

  for (const uuid of uuids) {
    const summary = ensureSummary(uuid);
    const ramTotal = memoryTotal.get(uuid) ?? 0;
    const storageTotal = diskTotal.get(uuid) ?? 0;
    if (ramTotal > 0) summary.memoryPeak = ((memoryUsed.get(uuid) ?? 0) / ramTotal) * 100;
    if (storageTotal > 0) summary.diskPeak = ((diskUsed.get(uuid) ?? 0) / storageTotal) * 100;
  }

  const pingByNode = new Map<string, PingMetricStat[]>();
  for (const stat of pingStats) {
    const list = pingByNode.get(stat.entityId) ?? [];
    list.push(stat);
    pingByNode.set(stat.entityId, list);
  }
  for (const [uuid, stats] of pingByNode) {
    const summary = ensureSummary(uuid);
    const validStats = stats.filter((stat) => stat.valid > 0 && stat.avg != null);
    const totalValid = validStats.reduce((sum, stat) => sum + stat.valid, 0);
    if (totalValid > 0) {
      summary.avgLatency = validStats.reduce(
        (sum, stat) => sum + (stat.avg ?? 0) * stat.valid,
        0,
      ) / totalValid;
      summary.volatility = validStats.reduce(
        (sum, stat) => sum + (stat.stddev ?? 0) * stat.valid,
        0,
      ) / totalValid;
    }
    const exactLoss = stats.filter((stat) => stat.total > 0 && !stat.lossApproximate);
    const totalSamples = exactLoss.reduce((sum, stat) => sum + stat.total, 0);
    if (totalSamples > 0) {
      summary.avgLoss = exactLoss.reduce(
        (sum, stat) => sum + stat.loss * stat.total,
        0,
      ) / totalSamples;
    }
  }

  return summaries;
}
