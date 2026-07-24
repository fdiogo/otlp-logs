"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBucketTick } from "./formatTick";
import type { LogHistogramProps } from "./types";

export function LogHistogram({
  buckets,
  bucketDurationMs,
  height = 160,
  className,
  onBucketClick,
}: LogHistogramProps) {
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
          <Bar
            dataKey="count"
            fill="currentColor"
            className="text-blue-500"
            onClick={
              onBucketClick &&
              ((bar) => onBucketClick(bar.payload as LogHistogramProps["buckets"][number]))
            }
            cursor={onBucketClick ? "pointer" : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
