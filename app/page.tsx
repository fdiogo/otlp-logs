"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Group, List } from "lucide-react";
import { logsQuery } from "@/queries/logsQuery";
import type { LogRecord, Resource, ResourceLogs } from "@/queries/logsQuery";
import { LogHistogram } from "@/components/LogHistogram";
import type {
  LogHistogramBucket,
  StackedHistogramBucket,
  StackedHistogramSeries,
} from "@/components/LogHistogram";
import { LogRecordsTable } from "@/components/LogRecordsTable";
import { ToggleGroup } from "@/design-system/ToggleGroup";
import { Skeleton } from "@/design-system/Skeleton";

/** Bar heights (%) for the histogram skeleton, loosely mimicking a log volume shape. */
const HISTOGRAM_SKELETON_BAR_HEIGHTS = [
  30, 45, 35, 60, 50, 70, 55, 80, 65, 90, 75, 60, 85, 50, 40, 55, 35, 45, 30, 40,
];

/** Row count for the table skeleton. */
const TABLE_SKELETON_ROW_COUNT = 12;

const VIEW_OPTIONS = [
  { value: "flat" as const, label: "None", icon: List },
  { value: "grouped" as const, label: "Service", icon: Group },
];

/** OpenTelemetry's own convention for a resource with no service.name attribute set. */
const UNKNOWN_SERVICE_NAME = "unknown_service";

function getStringAttribute(resource: Resource | undefined, key: string): string | undefined {
  return resource?.attributes?.find((attribute) => attribute.key === key)?.value?.stringValue;
}

/** Identifies a resource by service.namespace + service.name, namespace omitted when unset. */
function getResourceLabel(resource: Resource | undefined): string {
  const namespace = getStringAttribute(resource, "service.namespace");
  const name = getStringAttribute(resource, "service.name") ?? UNKNOWN_SERVICE_NAME;
  return namespace ? `${namespace}/${name}` : name;
}

interface ServiceGroup {
  /** Stable identity: service.namespace + service.name, namespace omitted when unset. */
  key: string;
  label: string;
  logRecords: LogRecord[];
}

/**
 * Compares log records by `timeUnixNano` descending (most recent first).
 * Records missing a timestamp sort last.
 */
function compareByTimeDesc(a: { timeUnixNano?: string | number | null }, b: { timeUnixNano?: string | number | null }): number {
  if (a.timeUnixNano == null) return b.timeUnixNano == null ? 0 : 1;
  if (b.timeUnixNano == null) return -1;
  const aNano = BigInt(a.timeUnixNano);
  const bNano = BigInt(b.timeUnixNano);
  return aNano < bNano ? 1 : aNano > bNano ? -1 : 0;
}

/**
 * Groups log records by Service Group (service.namespace + service.name).
 * Merges resourceLogs entries that resolve to the same key, since the same
 * service can appear as multiple separate resources. Groups are sorted
 * descending by count; each group's logRecords are sorted descending by time.
 */
function groupLogRecordsByService(resourceLogs: ResourceLogs[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();

  for (const resourceLog of resourceLogs) {
    const logRecords = (resourceLog.scopeLogs ?? []).flatMap((scopeLog) => scopeLog.logRecords ?? []);
    if (logRecords.length === 0) continue;

    const key = getResourceLabel(resourceLog.resource);
    const existing = groups.get(key);
    if (existing) {
      existing.logRecords.push(...logRecords);
    } else {
      groups.set(key, { key, label: key, logRecords });
    }
  }

  for (const group of groups.values()) {
    group.logRecords.sort(compareByTimeDesc);
  }

  return [...groups.values()].sort((a, b) => b.logRecords.length - a.logRecords.length);
}

/**
 * Ladder of "nice" bucket widths, in ms, from finest to coarsest.
 * 1/5/10/15/30 progression per unit (seconds, minutes, hours), extended
 * with day-scale steps for multi-day spans.
 */
const BUCKET_DURATION_LADDER_MS = [
  1_000,
  5_000,
  10_000,
  15_000,
  30_000,
  60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  5 * 60 * 60_000,
  10 * 60 * 60_000,
  15 * 60 * 60_000,
  24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000,
] as const;

/** Upper bound on the number of buckets a chart should render. */
const MAX_BUCKET_COUNT = 75;

/**
 * Picks the finest bucket width from `BUCKET_DURATION_LADDER_MS` that keeps
 * the number of buckets spanning [minTimeMs, maxTimeMs] at or below
 * `MAX_BUCKET_COUNT`. Falls back to the coarsest ladder step for spans wider
 * than the ladder covers, and to the finest step for a zero-width span.
 */
function computeBucketDuration(minTimeMs: number, maxTimeMs: number): number {
  const span = Math.max(0, maxTimeMs - minTimeMs);
  if (span === 0) return BUCKET_DURATION_LADDER_MS[0];

  const fitting = BUCKET_DURATION_LADDER_MS.find(
    (candidate) => span / candidate <= MAX_BUCKET_COUNT,
  );
  return fitting ?? BUCKET_DURATION_LADDER_MS[BUCKET_DURATION_LADDER_MS.length - 1];
}

function bucketLogRecords(
  logRecords: { timeUnixNano?: string | number | null }[],
  bucketDurationMs: number,
): LogHistogramBucket[] {
  const counts = new Map<number, number>();

  for (const record of logRecords) {
    if (record.timeUnixNano == null) continue;
    const timeMs = Number(BigInt(record.timeUnixNano) / BigInt(1_000_000));
    const bucketStart = Math.floor(timeMs / bucketDurationMs) * bucketDurationMs;
    counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, count]) => ({ time, count }));
}

/** Histogram-only: stacks the 8 highest-volume Service Groups, folds the rest into "Other". */
const TOP_N = 8;
const OTHER_SERIES_KEY = "__other__";

/**
 * Buckets Service Groups into a stacked time series. Ranking of which
 * services get their own segment is computed once, globally, over total
 * volume (not per bucket), so a series' color and stack position stay
 * stable across every bucket. `serviceGroups` must already be sorted
 * descending by count (as returned by `groupLogRecordsByService`).
 */
function bucketLogRecordsByService(
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

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGrouped = searchParams.has("groupBy");

  const handleViewChange = useCallback(
    (value: "flat" | "grouped") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (value === "grouped") {
        nextParams.set("groupBy", "service");
      } else {
        nextParams.delete("groupBy");
      }
      router.push(`?${nextParams.toString()}`);
    },
    [router, searchParams],
  );

  const { data: resourceLogs = [], isPending } = useQuery({
    ...logsQuery,
    select: (data) => data?.resourceLogs ?? [],
  });

  const logRecords = useMemo(
    () =>
      resourceLogs
        .flatMap((resourceLog) => {
          const resourceLabel = getResourceLabel(resourceLog.resource);
          return (resourceLog.scopeLogs ?? []).flatMap((scopeLog) =>
            (scopeLog.logRecords ?? []).map((logRecord) => ({ ...logRecord, resourceLabel })),
          );
        })
        .sort(compareByTimeDesc),
    [resourceLogs],
  );
  const serviceGroups = useMemo(() => groupLogRecordsByService(resourceLogs), [resourceLogs]);

  const bucketDurationMs = useMemo(() => {
    let minTimeMs = Infinity;
    let maxTimeMs = -Infinity;
    for (const record of logRecords) {
      if (record.timeUnixNano == null) continue;
      const timeMs = Number(BigInt(record.timeUnixNano) / BigInt(1_000_000));
      if (timeMs < minTimeMs) minTimeMs = timeMs;
      if (timeMs > maxTimeMs) maxTimeMs = timeMs;
    }
    if (minTimeMs === Infinity) return BUCKET_DURATION_LADDER_MS[0];
    return computeBucketDuration(minTimeMs, maxTimeMs);
  }, [logRecords]);

  const flatBuckets = useMemo(
    () => bucketLogRecords(logRecords, bucketDurationMs),
    [logRecords, bucketDurationMs],
  );
  const groupedBuckets = useMemo(
    () => bucketLogRecordsByService(serviceGroups, bucketDurationMs),
    [serviceGroups, bucketDurationMs],
  );

  return (
    <div className="h-screen p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Logs</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-panel-muted">Group by</span>
          <ToggleGroup
            value={isGrouped ? "grouped" : "flat"}
            onChange={handleViewChange}
            options={VIEW_OPTIONS}
          />
        </div>
      </div>

      {isPending ? (
        <div className="mb-4 flex h-40 items-end gap-1.5 rounded-lg border border-panel-border bg-panel p-3">
          {HISTOGRAM_SKELETON_BAR_HEIGHTS.map((heightPercent, index) => (
            <Skeleton key={index} className="flex-1" style={{ height: `${heightPercent}%` }} />
          ))}
        </div>
      ) : isGrouped ? (
        <LogHistogram
          variant="stacked"
          {...groupedBuckets}
          bucketDurationMs={bucketDurationMs}
          className="mb-4"
        />
      ) : (
        <LogHistogram buckets={flatBuckets} bucketDurationMs={bucketDurationMs} className="mb-4" />
      )}

      {isPending ? (
        <div className="h-150 overflow-hidden rounded-lg border border-panel-border bg-panel">
          <div className="flex items-center gap-3 border-b border-panel-border bg-panel-header px-3 py-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
          </div>
          {Array.from({ length: TABLE_SKELETON_ROW_COUNT }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-panel-border-subtle px-3 py-3"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : isGrouped ? (
        <LogRecordsTable groups={serviceGroups} />
      ) : (
        <LogRecordsTable logRecords={logRecords} />
      )}
    </div>
  );
}
