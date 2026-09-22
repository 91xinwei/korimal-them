import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useVisibleNodeUuids } from "@/hooks/useNode";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { getNodesLatestStatus, getPingOverview } from "@/services/api";
import type { PingOverviewBucket, PingOverviewItem, PingTask } from "@/types/komari";
import {
  invertHomepagePingTaskBindings,
  normalizeHomepagePingTaskBindings,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";

const DEFAULT_PING_REFRESH_INTERVAL = 60_000;
const MIN_PING_REFRESH_INTERVAL = 10_000;
const MAX_PING_REFRESH_INTERVAL = 300_000;
// Homepage mini charts intentionally stay at 24 frontend aggregation buckets.
// The homepage cards are for quick trend reading, so we aggregate the latest hour into
// 24 equal windows instead of showing one raw backend bucket per bar.
const MAX_VISIBLE_HOMEPAGE_PING_BUCKETS = 24;

const EMPTY_PING: PingOverviewItem = {
  client: "",
  isAssigned: false,
  lastValue: null,
  values: [],
  samples: [],
  max: 1,
  loss: null,
};
const EMPTY_PING_SERIES: PingMiniSeries[] = [];

interface PingOverviewMapResult {
  assignmentKey: string;
  intervalMs: number;
  items: Map<string, PingOverviewItem>;
  series: Map<string, PingMiniSeries[]>;
}

export interface PingMiniSeries extends PingOverviewItem {
  taskId: number;
  taskName: string;
  taskTarget: string;
  taskType: string;
}

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Normalize the official common:getNodesLatestStatus[uuid].ping map. */
export function normalizeLatestPingSeries(
  uuid: string,
  latestStatus: unknown,
): PingMiniSeries[] {
  const status = recordValue(latestStatus);
  const ping = recordValue(status.ping);
  const result: PingMiniSeries[] = [];

  for (const [taskKey, raw] of Object.entries(ping)) {
    const taskId = Number(taskKey);
    if (!Number.isInteger(taskId) || taskId <= 0) continue;
    const stat = recordValue(raw);
    const latest = finiteNumber(stat.latest);
    const average = finiteNumber(stat.avg);
    const loss = finiteNumber(stat.loss);
    const minimum = finiteNumber(stat.min);
    const maximum = finiteNumber(stat.max);
    const lastValue = latest != null && latest >= 0
      ? latest
      : average != null && average >= 0
        ? average
        : null;

    result.push({
      client: uuid,
      isAssigned: true,
      lastValue,
      values: [],
      samples: [],
      max: Math.max(1, maximum ?? lastValue ?? minimum ?? 1),
      loss: loss == null ? null : Math.min(100, Math.max(0, loss)),
      taskId,
      taskName: typeof stat.name === "string" && stat.name.trim()
        ? stat.name.trim()
        : `任务 #${taskId}`,
      taskTarget: "",
      taskType: "icmp",
    });
  }

  return result.sort((left, right) => left.taskId - right.taskId);
}

function mergeLatestSeries(
  historical: PingMiniSeries[],
  latest: PingMiniSeries[],
) {
  const merged = new Map(historical.map((item) => [item.taskId, item]));
  for (const live of latest) {
    const prior = merged.get(live.taskId);
    merged.set(live.taskId, prior
      ? {
          ...prior,
          taskName: live.taskName || prior.taskName,
          lastValue: live.lastValue ?? prior.lastValue,
          loss: live.loss ?? prior.loss,
          max: Math.max(prior.max, live.max),
        }
      : live);
  }
  return [...merged.values()].sort((left, right) => left.taskId - right.taskId);
}

type Listener = () => void;
interface PingOverviewStoreEntry {
  item: PingOverviewItem;
  missingRounds: number;
}

// Homepage monitoring should never flash back to an empty state after it has
// received valid data. Keep the last successful snapshot through transient
// RPC/API gaps; a changed assignment key still clears data that no longer
// belongs to the current configuration.
const PING_OVERVIEW_MISSING_GRACE_ROUNDS = Number.POSITIVE_INFINITY;

function toTimestamp(value: string | number) {
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeRefreshInterval(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return DEFAULT_PING_REFRESH_INTERVAL;
  }

  return Math.min(
    MAX_PING_REFRESH_INTERVAL,
    Math.max(MIN_PING_REFRESH_INTERVAL, seconds * 1000),
  );
}

function normalizeVisibleUuids(uuids: string[]) {
  return Array.from(new Set(uuids.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function stringifyBindings(bindings: HomepagePingTaskBindings) {
  return JSON.stringify(
    Object.entries(bindings)
      .map(([taskId, clients]) => [taskId, [...clients].sort((left, right) => left.localeCompare(right))])
      .sort(([left], [right]) => Number(left) - Number(right)),
  );
}

function equalNumberArray(a: number[], b: number[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function equalSamples(
  a: Array<{ time: number; value: number }>,
  b: Array<{ time: number; value: number }>,
) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.time !== b[i]?.time || a[i]?.value !== b[i]?.value) return false;
  }
  return true;
}

function equalPingItem(a: PingOverviewItem | undefined, b: PingOverviewItem | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.client === b.client &&
    a.isAssigned === b.isAssigned &&
    a.lastValue === b.lastValue &&
    a.max === b.max &&
    a.loss === b.loss &&
    equalNumberArray(a.values, b.values) &&
    equalSamples(a.samples, b.samples)
  );
}

function equalPingSeries(a: PingMiniSeries[] | undefined, b: PingMiniSeries[] | undefined) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return Boolean(other) && item.taskId === other.taskId && item.taskName === other.taskName &&
      item.taskTarget === other.taskTarget && equalPingItem(item, other);
  });
}

function buildPingOverviewItems(
  taskId: number,
  records: Array<{ task_id: number; time: string | number; value: number; client: string }>,
) {
  const selectedRecords = records.filter((record) => record.task_id === taskId);
  const grouped = new Map<string, Array<(typeof selectedRecords)[number]>>();
  const lossStatsByClient = new Map<string, { total: number; lost: number }>();

  for (const record of selectedRecords) {
    if (!record.client) continue;
    const current = grouped.get(record.client);
    if (current) current.push(record);
    else grouped.set(record.client, [record]);

    const stats = lossStatsByClient.get(record.client) ?? { total: 0, lost: 0 };
    stats.total += 1;
    if (record.value <= 0) {
      stats.lost += 1;
    }
    lossStatsByClient.set(record.client, stats);
  }

  const result = new Map<string, PingOverviewItem>();
  for (const [client, clientRecords] of grouped) {
    const sorted = [...clientRecords].sort(
      (left, right) => toTimestamp(left.time) - toTimestamp(right.time),
    );
    const latestRecord = sorted[sorted.length - 1];
    const values: number[] = new Array(sorted.length);
    const samples: Array<{ time: number; value: number }> = [];
    let max = 1;

    for (let i = 0; i < sorted.length; i++) {
      const record = sorted[i];
      const value = record.value;
      const time = toTimestamp(record.time);
      values[i] = value;
      if (time > 0) {
        samples.push({ time, value });
      }
      if (value > max) {
        max = value;
      }
    }

    const lossStats = lossStatsByClient.get(client);
    result.set(client, {
      client,
      isAssigned: true,
      lastValue: latestRecord && latestRecord.value > 0 ? latestRecord.value : null,
      values,
      samples,
      max,
      loss: lossStats?.total ? (lossStats.lost / lossStats.total) * 100 : null,
    });
  }

  return result;
}

function resolveSelectedTasks(
  clientUuids: string[],
  bindings: HomepagePingTaskBindings,
) {
  const selectedTaskByClient = new Map<string, number>();
  const bindingSelection = invertHomepagePingTaskBindings(bindings);

  for (const uuid of clientUuids) {
    const taskId = bindingSelection.get(uuid);
    if (taskId != null) {
      selectedTaskByClient.set(uuid, taskId);
    }
  }

  return selectedTaskByClient;
}

function resolveBoundTaskIds(clientUuids: string[], bindings: HomepagePingTaskBindings) {
  const visible = new Set(clientUuids);
  return Object.entries(bindings)
    .filter(([taskId, clients]) => Number(taskId) > 0 && clients.some((uuid) => visible.has(uuid)))
    .map(([taskId]) => Number(taskId));
}

function mergePingSeries(
  target: Map<string, PingMiniSeries[]>,
  task: PingTask,
  records: Array<{ task_id: number; time: string | number; value: number; client: string }>,
  visibleUuids: Set<string>,
) {
  const items = buildPingOverviewItems(task.id, records);
  for (const [uuid, item] of items) {
    if (!visibleUuids.has(uuid)) continue;
    const current = target.get(uuid) ?? [];
    if (current.some((entry) => entry.taskId === task.id)) continue;
    current.push({
      ...item,
      taskId: task.id,
      taskName: task.name.trim() || `Ping #${task.id}`,
      taskTarget: task.target,
      taskType: task.type,
    });
    target.set(uuid, current);
  }
}

function resolveAutomaticTasks(
  clientUuids: string[],
  records: Array<{ task_id: number; time: string | number; client: string }>,
  selectedTaskByClient: Map<string, number>,
) {
  const visible = new Set(clientUuids);
  const latestByClient = new Map<string, { taskId: number; timestamp: number }>();

  for (const record of records) {
    if (
      !visible.has(record.client) ||
      selectedTaskByClient.has(record.client) ||
      !Number.isInteger(record.task_id) ||
      record.task_id <= 0
    ) {
      continue;
    }
    const timestamp = toTimestamp(record.time);
    const current = latestByClient.get(record.client);
    if (!current || timestamp > current.timestamp) {
      latestByClient.set(record.client, { taskId: record.task_id, timestamp });
    }
  }

  for (const [client, selection] of latestByClient) {
    selectedTaskByClient.set(client, selection.taskId);
  }
}

function buildAssignmentKey(selectedTaskByClient: Map<string, number>) {
  return Array.from(selectedTaskByClient.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([uuid, taskId]) => `${uuid}:${taskId}`)
    .join("|");
}

async function buildOverviewMap(
  hours: number,
  clientUuids: string[],
  bindings: HomepagePingTaskBindings,
): Promise<PingOverviewMapResult> {
  const normalizedUuids = normalizeVisibleUuids(clientUuids);
  if (normalizedUuids.length === 0) {
    return {
      assignmentKey: "",
      intervalMs: DEFAULT_PING_REFRESH_INTERVAL,
      items: new Map<string, PingOverviewItem>(),
      series: new Map<string, PingMiniSeries[]>(),
    };
  }

  const selectedTaskByClient = resolveSelectedTasks(normalizedUuids, bindings);
  const boundTaskIds = resolveBoundTaskIds(normalizedUuids, bindings);
  let automaticOverview: Awaited<ReturnType<typeof getPingOverview>> | null = null;
  let latestStatuses: Record<string, unknown> = {};

  try {
    latestStatuses = await getNodesLatestStatus(normalizedUuids);
  } catch {
    // Historical Ping remains available on older Komari servers.
  }

  try {
    automaticOverview = await getPingOverview(hours);
    if (selectedTaskByClient.size < normalizedUuids.length) {
      resolveAutomaticTasks(
        normalizedUuids,
        automaticOverview.records,
        selectedTaskByClient,
      );
    }
  } catch {
    // Older Komari versions may require a concrete task id. Explicit bindings
    // continue to work, while unbound cards render a clear placeholder.
  }
  const selectedTaskIds = Array.from(new Set([...selectedTaskByClient.values(), ...boundTaskIds])).sort(
    (left, right) => left - right,
  );

  const itemsByTask = new Map<number, Map<string, PingOverviewItem>>();
  const series = new Map<string, PingMiniSeries[]>();
  const knownTasks = new Map<number, PingTask>();
  const visibleUuidSet = new Set(normalizedUuids);
  const refreshIntervals: number[] = [];

  if (automaticOverview) {
    for (const task of automaticOverview.tasks) {
      knownTasks.set(task.id, task);
      mergePingSeries(series, task, automaticOverview.records, visibleUuidSet);
    }
    for (const taskId of selectedTaskIds) {
      const automaticItems = buildPingOverviewItems(taskId, automaticOverview.records);
      if (automaticItems.size > 0) itemsByTask.set(taskId, automaticItems);
      const taskInterval = automaticOverview.tasks.find((task) => task.id === taskId)?.interval;
      if (taskInterval != null) refreshIntervals.push(normalizeRefreshInterval(taskInterval));
    }
  }

  const overviewResults = await Promise.allSettled(
    selectedTaskIds.filter((taskId) => !itemsByTask.has(taskId)).map(async (taskId) => ({
      taskId,
      overview: await getPingOverview(hours, taskId),
    })),
  );

  for (const result of overviewResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const {
      taskId,
      overview: { records, tasks },
    } = result.value;
    itemsByTask.set(taskId, buildPingOverviewItems(taskId, records));

    const task = tasks.find((candidate) => candidate.id === taskId) ?? {
      id: taskId,
      interval: 60,
      name: `Ping #${taskId}`,
      loss: 0,
      clients: [],
      type: "icmp",
      target: "",
      weight: 0,
    };
    knownTasks.set(task.id, task);
    mergePingSeries(series, task, records, visibleUuidSet);

    const taskInterval = tasks.find((task) => task.id === taskId)?.interval;
    refreshIntervals.push(normalizeRefreshInterval(taskInterval));
  }

  const items = new Map<string, PingOverviewItem>();
  for (const [uuid, taskId] of selectedTaskByClient) {
    const item = itemsByTask.get(taskId)?.get(uuid);
    if (item) {
      items.set(uuid, item);
      continue;
    }
    items.set(uuid, {
      client: uuid,
      isAssigned: true,
      lastValue: null,
      values: [],
      samples: [],
      max: 1,
      loss: null,
    });
  }

  const normalizedSeries = new Map<string, PingMiniSeries[]>();
  for (const uuid of normalizedUuids) {
    const explicitlyBound = Object.entries(bindings)
      .filter(([, clients]) => clients.includes(uuid))
      .map(([taskId]) => Number(taskId));
    const entries = [...(series.get(uuid) ?? [])];
    for (const taskId of explicitlyBound) {
      if (entries.some((entry) => entry.taskId === taskId)) continue;
      const task = knownTasks.get(taskId);
      entries.push({
        ...EMPTY_PING,
        client: uuid,
        isAssigned: true,
        taskId,
        taskName: task?.name.trim() || `Ping #${taskId}`,
        taskTarget: task?.target || "",
        taskType: task?.type || "icmp",
      });
    }
    const visibleEntries = mergeLatestSeries(
      entries,
      normalizeLatestPingSeries(uuid, latestStatuses[uuid]),
    )
      .slice(0, 6);
    if (visibleEntries.length > 0) normalizedSeries.set(uuid, visibleEntries);

    const selectedTaskId = selectedTaskByClient.get(uuid);
    const primary = selectedTaskId != null
      ? visibleEntries.find((entry) => entry.taskId === selectedTaskId)
      : visibleEntries[0];
    if (primary && !items.has(uuid)) items.set(uuid, primary);
  }

  return {
    assignmentKey: buildAssignmentKey(selectedTaskByClient),
    intervalMs:
      refreshIntervals.length > 0
        ? Math.min(...refreshIntervals)
        : DEFAULT_PING_REFRESH_INTERVAL,
    items,
    series: normalizedSeries,
  };
}

interface PingOverviewStoreState {
  assignmentKey: string;
  intervalMs: number;
  items: Map<string, PingOverviewStoreEntry>;
  series: Map<string, PingMiniSeries[]>;
}

let pingOverviewState: PingOverviewStoreState = {
  assignmentKey: "",
  intervalMs: DEFAULT_PING_REFRESH_INTERVAL,
  items: new Map(),
  series: new Map(),
};
let scheduledVisibleUuids: string[] = [];
let scheduledVisibleKey = "";
let scheduledBindings: HomepagePingTaskBindings = {};
let scheduledBindingsKey = stringifyBindings({});
let pingRefreshInFlight = false;
let pingRefreshTimer: number | null = null;
const pingListeners = new Map<string, Set<Listener>>();

function schedulePingRefresh(intervalMs: number) {
  if (pingRefreshTimer != null) {
    window.clearTimeout(pingRefreshTimer);
  }
  pingRefreshTimer = window.setTimeout(() => {
    pingRefreshTimer = null;
    void refreshPingOverview();
  }, intervalMs);
}

function commitPingOverview(
  assignmentKey: string,
  intervalMs: number,
  items: Map<string, PingOverviewItem>,
  series: Map<string, PingMiniSeries[]>,
) {
  const prevItems = pingOverviewState.items;
  const preserveMissing = pingOverviewState.assignmentKey === assignmentKey;
  const stableSeries = new Map<string, PingMiniSeries[]>();
  const seriesKeys = new Set([...pingOverviewState.series.keys(), ...series.keys()]);
  for (const key of seriesKeys) {
    const previous = pingOverviewState.series.get(key) ?? EMPTY_PING_SERIES;
    const incoming = series.get(key) ?? EMPTY_PING_SERIES;
    if (!preserveMissing) {
      if (incoming.length > 0) stableSeries.set(key, incoming);
      continue;
    }
    const merged = incoming.map((next) => {
      const prior = previous.find((item) => item.taskId === next.taskId);
      return next.samples.length === 0 && prior && prior.samples.length > 0
        ? {
            ...next,
            values: prior.values,
            samples: prior.samples,
            max: Math.max(next.max, prior.max),
          }
        : next;
    });
    for (const prior of previous) {
      if (!merged.some((item) => item.taskId === prior.taskId)) merged.push(prior);
    }
    if (merged.length > 0) stableSeries.set(key, merged);
  }
  const nextItems = new Map<string, PingOverviewStoreEntry>();
  const touched = new Set<string>();
  const keys = new Set<string>([...prevItems.keys(), ...items.keys()]);

  for (const key of keys) {
    const prevEntry = prevItems.get(key);
    const prev = prevEntry?.item;
    const next = items.get(key);

    if (!next) {
      if (
        preserveMissing &&
        prevEntry &&
        prevEntry.missingRounds < PING_OVERVIEW_MISSING_GRACE_ROUNDS
      ) {
        nextItems.set(key, {
          ...prevEntry,
          missingRounds: prevEntry.missingRounds + 1,
        });
        continue;
      }
      if (prevEntry) touched.add(key);
      continue;
    }

    if (equalPingItem(prev, next)) {
      nextItems.set(key, {
        item: prev ?? next,
        missingRounds: 0,
      });
      continue;
    }

    nextItems.set(key, {
      item: next,
      missingRounds: 0,
    });
    touched.add(key);
  }

  for (const key of seriesKeys) {
    if (!equalPingSeries(pingOverviewState.series.get(key), stableSeries.get(key))) touched.add(key);
  }

  if (
    pingOverviewState.assignmentKey === assignmentKey &&
    pingOverviewState.intervalMs === intervalMs &&
    touched.size === 0 &&
    nextItems.size === prevItems.size
  ) {
    return;
  }

  pingOverviewState = {
    assignmentKey,
    intervalMs,
    items: nextItems,
    series: stableSeries,
  };

  for (const key of touched) {
    const listeners = pingListeners.get(key);
    if (!listeners) continue;
    for (const listener of listeners) listener();
  }
}

async function refreshPingOverview() {
  if (pingRefreshInFlight) return;

  pingRefreshInFlight = true;
  const visibleKey = scheduledVisibleKey;
  const bindingsKey = scheduledBindingsKey;

  try {
    if (scheduledVisibleUuids.length === 0) {
      commitPingOverview("", DEFAULT_PING_REFRESH_INTERVAL, new Map(), new Map());
      return;
    }

    const next = await buildOverviewMap(
      1,
      scheduledVisibleUuids,
      scheduledBindings,
    );
    if (
      visibleKey === scheduledVisibleKey &&
      bindingsKey === scheduledBindingsKey
    ) {
      commitPingOverview(next.assignmentKey, next.intervalMs, next.items, next.series);
      schedulePingRefresh(next.intervalMs);
    }
  } catch {
    if (
      visibleKey === scheduledVisibleKey &&
      bindingsKey === scheduledBindingsKey
    ) {
      schedulePingRefresh(DEFAULT_PING_REFRESH_INTERVAL);
    }
  } finally {
    pingRefreshInFlight = false;
    if (
      visibleKey !== scheduledVisibleKey ||
      bindingsKey !== scheduledBindingsKey
    ) {
      void refreshPingOverview();
    }
  }
}

function ensurePingOverviewStarted(
  visibleUuids: string[],
  bindings: HomepagePingTaskBindings,
) {
  const normalizedVisibleUuids = normalizeVisibleUuids(visibleUuids);
  const visibleKey = normalizedVisibleUuids.join("|");
  const bindingsKey = stringifyBindings(bindings);

  if (
    scheduledVisibleKey !== visibleKey ||
    scheduledBindingsKey !== bindingsKey
  ) {
    scheduledVisibleUuids = normalizedVisibleUuids;
    scheduledVisibleKey = visibleKey;
    scheduledBindings = bindings;
    scheduledBindingsKey = bindingsKey;

    if (pingRefreshTimer != null) {
      window.clearTimeout(pingRefreshTimer);
      pingRefreshTimer = null;
    }
    void refreshPingOverview();
    return;
  }

  if (
    normalizedVisibleUuids.length > 0 &&
    !pingRefreshInFlight &&
    pingRefreshTimer == null &&
    pingOverviewState.items.size === 0
  ) {
    void refreshPingOverview();
  }
}

function subscribeToPingItem(uuid: string, listener: Listener) {
  let listeners = pingListeners.get(uuid);
  if (!listeners) {
    listeners = new Set();
    pingListeners.set(uuid, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      pingListeners.delete(uuid);
    }
  };
}

function getPingSnapshot(uuid: string) {
  return pingOverviewState.items.get(uuid)?.item ?? EMPTY_PING;
}

export function getPingMiniSnapshot(uuid: string) {
  return getPingSnapshot(uuid);
}

function getPingSeriesSnapshot(uuid: string) {
  return pingOverviewState.series.get(uuid) ?? EMPTY_PING_SERIES;
}

function usePingOverviewScheduler(visibleUuids: string[]) {
  const { data: config } = usePublicConfig();
  const bindings = useMemo(
    () => normalizeHomepagePingTaskBindings(config?.theme_settings?.homepagePingBindings),
    [config?.theme_settings?.homepagePingBindings],
  );

  useEffect(() => {
    ensurePingOverviewStarted(visibleUuids, bindings);
  }, [bindings, visibleUuids]);
}

export function useHomepagePingOverview() {
  const visibleUuids = useVisibleNodeUuids();
  usePingOverviewScheduler(visibleUuids);
}

export function useHomepagePingOverviewForNodes(visibleUuids: string[]) {
  usePingOverviewScheduler(visibleUuids);
}

export function usePingMini(uuid: string): PingOverviewItem {
  return useSyncExternalStore(
    uuid ? (cb) => subscribeToPingItem(uuid, cb) : () => () => undefined,
    uuid ? () => getPingSnapshot(uuid) : () => EMPTY_PING,
    uuid ? () => getPingSnapshot(uuid) : () => EMPTY_PING,
  );
}

export function usePingMiniSeries(uuid: string): PingMiniSeries[] {
  return useSyncExternalStore(
    uuid ? (cb) => subscribeToPingItem(uuid, cb) : () => () => undefined,
    uuid ? () => getPingSeriesSnapshot(uuid) : () => EMPTY_PING_SERIES,
    uuid ? () => getPingSeriesSnapshot(uuid) : () => EMPTY_PING_SERIES,
  );
}

export function usePingMiniBuckets(
  ping: Pick<PingOverviewItem, "samples">,
  count?: number,
): PingOverviewBucket[] {
  return useMemo(() => {
    const now = Date.now();
    const totalWindowMs = 60 * 60 * 1000;
    const resolvedCount = count ?? MAX_VISIBLE_HOMEPAGE_PING_BUCKETS;
    const bucketMs = totalWindowMs / resolvedCount;
    const windowStart = now - bucketMs * resolvedCount;
    const totals = new Array<number>(resolvedCount).fill(0);
    const losts = new Array<number>(resolvedCount).fill(0);
    const positiveSums = new Array<number>(resolvedCount).fill(0);
    const positiveCounts = new Array<number>(resolvedCount).fill(0);

    for (const sample of ping.samples ?? []) {
      if (sample.time < windowStart || sample.time > now) continue;

      let bucketIndex = Math.floor((sample.time - windowStart) / bucketMs);
      if (bucketIndex < 0) continue;
      if (bucketIndex >= resolvedCount) bucketIndex = resolvedCount - 1;

      totals[bucketIndex] += 1;
      if (sample.value > 0) {
        positiveSums[bucketIndex] += sample.value;
        positiveCounts[bucketIndex] += 1;
      } else {
        losts[bucketIndex] += 1;
      }
    }

    return Array.from({ length: resolvedCount }, (_, index) => {
      const startAt = windowStart + index * bucketMs;
      const endAt = startAt + bucketMs;
      const total = totals[index];
      const lost = losts[index];
      const positiveCount = positiveCounts[index];

      return {
        index,
        value: positiveCount > 0 ? positiveSums[index] / positiveCount : null,
        loss: total > 0 ? (lost / total) * 100 : null,
        total,
        lost,
        startAt,
        endAt,
      };
    });
  }, [count, ping.samples]);
}
