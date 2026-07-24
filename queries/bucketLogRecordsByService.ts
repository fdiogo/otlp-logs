import type { ServiceGroup } from "@/queries/serviceGroup";
import type { StackedHistogramBucket, StackedHistogramSeries } from "@/components/LogHistogram/types";

/** Histogram-only: stacks the 8 highest-volume Service Groups, folds the rest into "Other". */
const TOP_N = 8;
export const OTHER_SERIES_KEY = "__other__";

/**
 * Buckets Service Groups into a stacked time series. Ranking of which
 * services get their own segment is computed once, globally, over total
 * volume (not per bucket), so a series' color and stack position stay
 * stable across every bucket. `serviceGroups` must already be sorted
 * descending by count (as returned by `groupLogRecordsByService`).
 */
export function bucketLogRecordsByService(
  serviceGroups: ServiceGroup[],
  bucketDurationMs: number,
): { buckets: StackedHistogramBucket[]; series: StackedHistogramSeries[] } {
  const topGroups = serviceGroups.slice(0, TOP_N);
  const otherGroups = serviceGroups.slice(TOP_N);

  const series: StackedHistogramSeries[] = topGroups.map((group) => ({
    key: group.key,
    label: group.label,
  }));
  if (otherGroups.length > 0) {
    series.push({ key: OTHER_SERIES_KEY, label: "Other" });
  }

  const bucketCounts = new Map<number, Record<string, number>>();

  function addRecord(key: string, timeUnixNano: string | number | null | undefined) {
    if (timeUnixNano == null) return;
    const timeMs = Number(BigInt(timeUnixNano) / BigInt(1_000_000));
    const bucketStart = Math.floor(timeMs / bucketDurationMs) * bucketDurationMs;
    const counts = bucketCounts.get(bucketStart) ?? {};
    counts[key] = (counts[key] ?? 0) + 1;
    bucketCounts.set(bucketStart, counts);
  }

  for (const group of topGroups) {
    for (const record of group.logRecords) {
      addRecord(group.key, record.timeUnixNano);
    }
  }
  for (const group of otherGroups) {
    for (const record of group.logRecords) {
      addRecord(OTHER_SERIES_KEY, record.timeUnixNano);
    }
  }

  const buckets: StackedHistogramBucket[] = [...bucketCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, counts]) => ({
      time,
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    }));

  return { buckets, series };
}
