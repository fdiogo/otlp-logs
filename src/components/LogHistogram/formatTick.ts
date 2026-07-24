export function formatBucketTick(time: number, bucketDurationMs: number): string {
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
