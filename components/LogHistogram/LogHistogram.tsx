"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBucketTick } from "./formatTick";
import type {
  LogHistogramProps,
  StackedHistogramBucket,
  StackedHistogramSeries,
} from "./types";

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
  bucketDurationMs,
  series,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; payload?: StackedHistogramBucket }[];
  bucketDurationMs: number;
  series: StackedHistogramSeries[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const bucket = payload[0]?.payload as StackedHistogramBucket | undefined;
  if (!bucket) return null;

  const rows = series
    .map((s, index) => ({ ...s, color: colorForSeries(s, index), count: bucket.counts[s.key] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded border bg-white p-2 text-xs shadow-sm dark:bg-neutral-900">
      <div className="mb-1 font-medium">{formatBucketTick(Number(label), bucketDurationMs)}</div>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex-1">{row.label}</span>
            <span className="tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{bucket.total}</span>
      </div>
    </div>
  );
}

export function LogHistogram(props: LogHistogramProps) {
  const { bucketDurationMs, height = 160, className } = props;

  if (props.variant === "stacked") {
    const { buckets, series } = props;
    return (
      <div className={className} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets}>
            <XAxis
              dataKey="time"
              tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
              fontSize={12}
            />
            <YAxis allowDecimals={false} fontSize={12} width={32} />
            <Tooltip
              content={
                <StackedTooltipContent bucketDurationMs={bucketDurationMs} series={series} />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={(bucket: StackedHistogramBucket) => bucket.counts[s.key] ?? 0}
                name={s.label}
                stackId="services"
                fill={colorForSeries(s, index)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const { buckets } = props;
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets}>
          <XAxis
            dataKey="time"
            tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
            fontSize={12}
          />
          <YAxis allowDecimals={false} fontSize={12} width={32} />
          <Tooltip
            labelFormatter={(time) => formatBucketTick(Number(time), bucketDurationMs)}
          />
          <Bar dataKey="count" fill="currentColor" className="text-blue-500" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
