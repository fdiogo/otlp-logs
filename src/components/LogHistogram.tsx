"use client";

import { useMemo } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Time } from "@/design-system/Time";

export interface LogHistogramBucket {
  /** Bucket start, unix ms */
  time: number;
  count: number;
}

export interface StackedHistogramSeries {
  key: string;
  label: string;
}

export interface StackedHistogramBucket {
  /** Bucket start, unix ms */
  time: number;
  total: number;
  /** Per-series count for this bucket, keyed by StackedHistogramSeries.key. */
  counts: Record<string, number>;
}

interface HistogramLogRecord {
  timeUnixNano?: string | number | null;
}

export interface HistogramServiceGroup {
  /** Stable identity, used as the stacked series key. */
  key: string;
  label: string;
  logRecords: HistogramLogRecord[];
}

interface LogHistogramBaseProps {
  height?: number;
  className?: string;
}

interface FlatLogHistogramProps extends LogHistogramBaseProps {
  variant?: "flat";
  logRecords: HistogramLogRecord[];
}

interface StackedLogHistogramProps extends LogHistogramBaseProps {
  variant: "stacked";
  /** Must already be sorted descending by count (as `groupLogRecordsByService` returns). */
  serviceGroups: HistogramServiceGroup[];
}

type LogHistogramProps = FlatLogHistogramProps | StackedLogHistogramProps;

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

/** Picks a bucket width that keeps `records`' time span at or below `MAX_BUCKET_COUNT` buckets. */
function computeBucketDurationForRecords(records: HistogramLogRecord[]): number {
  let minTimeMs = Infinity;
  let maxTimeMs = -Infinity;
  for (const record of records) {
    if (record.timeUnixNano == null) continue;
    const timeMs = Number(BigInt(record.timeUnixNano) / BigInt(1_000_000));
    if (timeMs < minTimeMs) minTimeMs = timeMs;
    if (timeMs > maxTimeMs) maxTimeMs = timeMs;
  }
  if (minTimeMs === Infinity) return BUCKET_DURATION_LADDER_MS[0];
  return computeBucketDuration(minTimeMs, maxTimeMs);
}

function bucketLogRecords(
  logRecords: HistogramLogRecord[],
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
 * descending by count (as returned by `groupLogRecordsByService`). Stacks the
 * 8 highest-volume Service Groups, folds the rest into "Other".
 */
function bucketLogRecordsByService(
  serviceGroups: HistogramServiceGroup[],
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

function bucketTimeToUnixNano(time: number): string {
  return String(Math.round(time) * 1_000_000);
}

function formatBucketTick(time: number, bucketDurationMs: number): string {
  const date = new Date(time);
  const showDate = bucketDurationMs >= 24 * 60 * 60 * 1000;

  if (showDate) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: bucketDurationMs < 60_000 ? "2-digit" : undefined,
  });
}

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];
const OTHER_COLOR = "var(--series-other)";

function colorForSeries(series: StackedHistogramSeries, index: number): string {
  return index < SERIES_COLORS.length ? SERIES_COLORS[index] : OTHER_COLOR;
}

function StackedTooltipContent({
  active,
  label,
  payload,
  series,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { payload?: StackedHistogramBucket }[];
  series: StackedHistogramSeries[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  const rows = series
    .map((s, index) => ({ ...s, color: colorForSeries(s, index), count: bucket.counts[s.key] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-3 text-xs shadow-sm">
      <div className="font-medium text-panel-muted">
        <Time unixNano={bucketTimeToUnixNano(Number(label))} />
      </div>
      <hr className="my-1 border-panel-border-subtle" />
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex-1 text-panel-muted">{row.label}</span>
            <span className="tabular-nums text-panel-muted">{row.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between gap-4 border-t border-panel-border-subtle pt-1 font-semibold text-panel-muted">
        <span>Total</span>
        <span className="tabular-nums">{bucket.total}</span>
      </div>
    </div>
  );
}

function FlatTooltipContent({
  label,
  active,
  payload,
}: {
  label?: string | number;
  active?: boolean;
  payload?: { value?: number }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-panel-muted">
        <Time unixNano={bucketTimeToUnixNano(Number(label))} />
      </div>
      <div className="mt-1 flex justify-between gap-4 text-panel-muted">
        <span>Count</span>
        <span className="tabular-nums font-semibold">{payload[0]?.value ?? 0}</span>
      </div>
    </div>
  );
}

// Tooltip renders in a recharts wrapper positioned earlier in the DOM than the Legend's wrapper,
// so without an explicit stacking order the legend (also position: absolute) paints on top of it.
const TOOLTIP_WRAPPER_STYLE = { zIndex: 50 };
const LEGEND_WRAPPER_STYLE = { fontSize: 12, color: "var(--panel-foreground-muted)" };

export function LogHistogram(props: LogHistogramProps) {
  const { height = 160, className } = props;
  const axisTick = { fill: "var(--panel-foreground-muted)" };

  const data = useMemo(() => {
    if (props.variant === "stacked") {
      const bucketDurationMs = computeBucketDurationForRecords(
        props.serviceGroups.flatMap((group) => group.logRecords),
      );
      return {
        variant: "stacked" as const,
        ...bucketLogRecordsByService(props.serviceGroups, bucketDurationMs),
        bucketDurationMs,
      };
    }
    const bucketDurationMs = computeBucketDurationForRecords(props.logRecords);
    return {
      variant: "flat" as const,
      buckets: bucketLogRecords(props.logRecords, bucketDurationMs),
      bucketDurationMs,
    };
  }, [props]);
  const { bucketDurationMs } = data;

  return (
    <div
      className={`rounded-lg border border-panel-border bg-panel p-3 ${className ?? ""}`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {data.variant === "stacked" ? (
          <BarChart data={data.buckets}>
            <XAxis
              dataKey="time"
              tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
              interval="preserveStartEnd"
              minTickGap={40}
              fontSize={12}
              tick={axisTick}
              stroke="var(--panel-border)"
            />
            <YAxis allowDecimals={false} fontSize={12} width={32} tick={axisTick} stroke="var(--panel-border)" />
            <Tooltip
              content={<StackedTooltipContent series={data.series} />}
              cursor={{ fill: "var(--panel-header-background)" }}
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
            />
            <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} iconType="circle" />
            {data.series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={(bucket: StackedHistogramBucket) => bucket.counts[s.key] ?? 0}
                name={s.label}
                stackId="services"
                fill={colorForSeries(s, index)}
              />
            ))}
          </BarChart>
        ) : (
          <BarChart data={data.buckets}>
            <XAxis
              dataKey="time"
              tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
              interval="preserveStartEnd"
              minTickGap={40}
              fontSize={12}
              tick={axisTick}
              stroke="var(--panel-border)"
            />
            <YAxis allowDecimals={false} fontSize={12} width={32} tick={axisTick} stroke="var(--panel-border)" />
            <Tooltip
              content={<FlatTooltipContent />}
              cursor={{ fill: "var(--panel-header-background)" }}
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
            />
            <Bar dataKey="count" fill="var(--series-1)" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
