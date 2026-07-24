"use client";

import { useMemo } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "cnfast";
import { Time } from "@/design-system/Time";

export interface HistogramProps {
  items: {
    /** ns since epoch, used to bucket this item. */
    timeUnixNano: string | number;
    /** Ignored when `variant` is `"flat"`. Omit for a single implicit group. Provide to stack by group. */
    groupKey?: string;
  }[];
  /**
   * `"grouped"` (default) stacks bars by each item's `groupKey`. `"flat"` ignores `groupKey`
   * and renders a single series. Lets callers keep one `groupKey`-tagged `items` array memoized
   * and just flip this to switch renderings, instead of maintaining two differently-shaped items lists.
   */
  variant?: "flat" | "grouped";
  /**
   * Cap on the number of stacked series drawn per bucket, ranked by each group's total
   * item count across all buckets (so segment identity, color, and stack position stay
   * fixed across buckets). Groups past the cap are folded into a single "Other" series.
   * Has no visible effect when `variant` is `"flat"`.
   * 
   * @default 8
   */
  maxGroupsPerBucket?: number;
  height?: number;
  className?: string;
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

const DEFAULT_GROUP_KEY = "__default__";
const OTHER_GROUP_KEY = "Other";

interface HistogramBucket {
  time: number;
  counts: Record<string, number>;
  total: number;
}

const DEFAULT_GROUP_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

// Tooltip renders in a recharts wrapper positioned earlier in the DOM than the Legend's wrapper,
// so without an explicit stacking order the legend (also position: absolute) paints on top of it.
const TOOLTIP_WRAPPER_STYLE = { zIndex: 50 };
const LEGEND_WRAPPER_STYLE = { fontSize: 12, color: "var(--panel-foreground-muted)" };

function HistogramTooltipContent({
  active,
  label,
  payload,
  groups,
  bucketDurationMs,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { payload?: HistogramBucket }[];
  groups: string[];
  bucketDurationMs: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  const bucketStartMs = Math.round(Number(label));
  const bucketEndMs = bucketStartMs + bucketDurationMs;

  if (groups.length <= 1) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-2 text-xs shadow-sm">
        <div className="flex items-baseline gap-1 font-medium text-panel-muted">
          <Time unixNano={String(bucketStartMs * 1_000_000)}  />
          <span>–</span>
          <Time unixNano={String(bucketEndMs * 1_000_000)} timeOnly />
        </div>
        <div className="mt-1 flex justify-between gap-4 text-panel-muted">
          <span>Count</span>
          <span className="tabular-nums font-semibold">{bucket.total}</span>
        </div>
      </div>
    );
  }

  const rows = groups
    .map((groupKey, index) => ({
      groupKey,
      color: DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length],
      count: bucket.counts[groupKey] ?? 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-3 text-xs shadow-sm">
      <div className="flex items-baseline gap-1 font-medium text-panel-muted">
        <Time unixNano={String(bucketStartMs * 1_000_000)} />
        <span>–</span>
        <Time unixNano={String(bucketEndMs * 1_000_000)} />
      </div>
      <hr className="my-1 border-panel-border-subtle" />
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.groupKey} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="flex-1 text-panel-muted">{row.groupKey}</span>
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

export function Histogram(props: HistogramProps) {
  const { items, variant = "grouped", maxGroupsPerBucket = 8, height = 160, className } = props;
  const axisTick = { fill: "var(--panel-foreground-muted)" };

  const data = useMemo(() => {
    const timesMs = items.map((item) => Number(BigInt(item.timeUnixNano) / BigInt(1_000_000)));

    let minTimeMs = Infinity;
    let maxTimeMs = -Infinity;
    for (const timeMs of timesMs) {
      if (timeMs < minTimeMs) minTimeMs = timeMs;
      if (timeMs > maxTimeMs) maxTimeMs = timeMs;
    }
    const span = minTimeMs === Infinity ? 0 : Math.max(0, maxTimeMs - minTimeMs);
    const bucketDurationMs =
      span === 0
        ? BUCKET_DURATION_LADDER_MS[0]
        : (BUCKET_DURATION_LADDER_MS.find((candidate) => span / candidate <= MAX_BUCKET_COUNT) ??
          BUCKET_DURATION_LADDER_MS[BUCKET_DURATION_LADDER_MS.length - 1]);

    const groupTotals = new Map<string, number>();
    for (const item of items) {
      const groupKey = variant === "flat" ? DEFAULT_GROUP_KEY : (item.groupKey ?? DEFAULT_GROUP_KEY);
      groupTotals.set(groupKey, (groupTotals.get(groupKey) ?? 0) + 1);
    }
    const rankedGroupKeys = [...groupTotals.entries()].sort(([, a], [, b]) => b - a).map(([groupKey]) => groupKey);
    const topGroupKeys = new Set(rankedGroupKeys.slice(0, maxGroupsPerBucket));
    const foldRemainder = rankedGroupKeys.length > maxGroupsPerBucket;

    const bucketCounts = new Map<number, Record<string, number>>();
    items.forEach((item, index) => {
      const bucketStart = Math.floor(timesMs[index] / bucketDurationMs) * bucketDurationMs;
      const rawGroupKey = variant === "flat" ? DEFAULT_GROUP_KEY : (item.groupKey ?? DEFAULT_GROUP_KEY);
      const groupKey = foldRemainder && !topGroupKeys.has(rawGroupKey) ? OTHER_GROUP_KEY : rawGroupKey;

      const counts = bucketCounts.get(bucketStart) ?? {};
      counts[groupKey] = (counts[groupKey] ?? 0) + 1;
      bucketCounts.set(bucketStart, counts);
    });

    const buckets = [...bucketCounts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, counts]) => ({
        time,
        counts,
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      }));

    const groups = foldRemainder ? [...rankedGroupKeys.slice(0, maxGroupsPerBucket), OTHER_GROUP_KEY] : rankedGroupKeys;

    return { buckets, groups, bucketDurationMs };
  }, [items, variant, maxGroupsPerBucket]);

  return (
    <div
      className={cn("histogram-root rounded-lg border border-panel-border bg-panel p-3", className)}
      style={{ height }}
    >
      {/*
        Highlight-on-legend-hover, done in pure CSS instead of React state: Recharts stamps each
        legend <li> with a stable `legend-item-{index}` class and forwards `className` onto each
        Bar's root <g>, so :has() can match a hovered legend entry and dim every other bar group
        without re-rendering the (potentially hundreds of) bar rectangles on every mouse move.
      */}
      <style>
        {`.histogram-root .recharts-bar { transition: opacity 0.15s ease; }
.histogram-root .recharts-legend-item { cursor: default; }
${data.groups
  .map(
    (_, index) =>
      `.histogram-root:has(.legend-item-${index}:hover) .recharts-bar:not(.histogram-bar-${index}) { opacity: 0.25; }`,
  )
  .join("\n")}`}
      </style>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.buckets}>
          <XAxis
            dataKey="time"
            tickFormatter={(time) => {
              const date = new Date(time);
              return data.bucketDurationMs >= 24 * 60 * 60 * 1000
                ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: data.bucketDurationMs < 60_000 ? "2-digit" : undefined,
                  });
            }}
            interval="preserveStartEnd"
            minTickGap={40}
            fontSize={12}
            tick={axisTick}
            stroke="var(--panel-border)"
          />
          <YAxis allowDecimals={false} fontSize={12} width={32} tick={axisTick} stroke="var(--panel-border)" />
          <Tooltip
            content={<HistogramTooltipContent groups={data.groups} bucketDurationMs={data.bucketDurationMs} />}
            cursor={{ fill: "var(--panel-header-background)" }}
            wrapperStyle={TOOLTIP_WRAPPER_STYLE}
          />
          {data.groups.length > 1 && (
            <Legend
              wrapperStyle={LEGEND_WRAPPER_STYLE}
              iconType="circle"
              // Recharts defaults to sorting legend items alphabetically by value, which would
              // desync the legend-item/bar index pairing the hover highlight CSS above relies on.
              itemSorter={(item) => data.groups.indexOf(String(item.value))}
            />
          )}
          {data.groups.map((groupKey, index) => (
            <Bar
              key={groupKey}
              className={`histogram-bar-${index}`}
              dataKey={(bucket: HistogramBucket) => bucket.counts[groupKey] ?? 0}
              name={groupKey}
              stackId="series"
              fill={DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
