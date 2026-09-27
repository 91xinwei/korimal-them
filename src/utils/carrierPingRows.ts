const CARRIERS = [
  { name: "上海电信", match: /电信|telecom/i, tone: "telecom" },
  { name: "上海联通", match: /联通|unicom/i, tone: "unicom" },
  { name: "上海移动", match: /移动|mobile|cmcc/i, tone: "mobile" },
] as const;

export function arrangeCarrierPingRows<T extends { taskId: number; taskName: string; taskTarget: string }>(series: T[]) {
  const used = new Set<number>();
  const carrierRows = CARRIERS.map((carrier) => {
    const item = series.find((entry) =>
      !used.has(entry.taskId) && carrier.match.test(`${entry.taskName} ${entry.taskTarget}`),
    );
    if (item) used.add(item.taskId);
    return { name: carrier.name as string, tone: carrier.tone as string, item };
  });
  const otherRows = series
    .filter((item) => !used.has(item.taskId))
    .map((item) => ({ name: item.taskName, tone: "other", item }));
  return [...carrierRows, ...otherRows];
}
