import type { LogHistogramBucket } from "@/components/LogHistogram";

type TimestampedRecord = { timeUnixNano?: string | number | null };

export function bucketLogRecords(
  logRecords: TimestampedRecord[],
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
