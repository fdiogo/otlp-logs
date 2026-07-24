"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBucketTick } from "./formatTick";
import type { LogHistogramProps, StackedHistogramBucket, StackedHistogramSeries } from "./types";

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
  payload?: { payload?: StackedHistogramBucket }[];
  bucketDurationMs: number;
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
        {formatBucketTick(Number(label), bucketDurationMs)}
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
  bucketDurationMs,
}: {
  label?: string | number;
  active?: boolean;
  payload?: { value?: number }[];
  bucketDurationMs: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-panel-muted">
        {formatBucketTick(Number(label), bucketDurationMs)}
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
const TOOLTIP_WRAPPER_STYLE = { zIndex: 1 };
const LEGEND_WRAPPER_STYLE = { fontSize: 12, color: "var(--panel-foreground-muted)" };

export function LogHistogram(props: LogHistogramProps) {
  const { bucketDurationMs, height = 160, className } = props;
  const axisTick = { fill: "var(--panel-foreground-muted)" };

  return (
    <div
      className={`rounded-lg border border-panel-border bg-panel p-3 ${className ?? ""}`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {props.variant === "stacked" ? (
          <BarChart data={props.buckets}>
            <XAxis
              dataKey="time"
              tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
              fontSize={12}
              tick={axisTick}
              stroke="var(--panel-border)"
            />
            <YAxis allowDecimals={false} fontSize={12} width={32} tick={axisTick} stroke="var(--panel-border)" />
            <Tooltip
              content={
                <StackedTooltipContent bucketDurationMs={bucketDurationMs} series={props.series} />
              }
              cursor={{ fill: "var(--panel-header-background)" }}
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
            />
            <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} iconType="circle" />
            {props.series.map((s, index) => (
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
          <BarChart data={props.buckets}>
            <XAxis
              dataKey="time"
              tickFormatter={(time) => formatBucketTick(time, bucketDurationMs)}
              fontSize={12}
              tick={axisTick}
              stroke="var(--panel-border)"
            />
            <YAxis allowDecimals={false} fontSize={12} width={32} tick={axisTick} stroke="var(--panel-border)" />
            <Tooltip
              content={<FlatTooltipContent bucketDurationMs={bucketDurationMs} />}
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
