/**
 * Ladder of "nice" bucket widths, in ms, from finest to coarsest.
 * 1/5/10/15/30 progression per unit (seconds, minutes, hours), extended
 * with day-scale steps for multi-day spans.
 */
export const BUCKET_DURATION_LADDER_MS = [
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
export const MAX_BUCKET_COUNT = 75;

/**
 * Picks the finest bucket width from `BUCKET_DURATION_LADDER_MS` that keeps
 * the number of buckets spanning [minTimeMs, maxTimeMs] at or below
 * `MAX_BUCKET_COUNT`. Falls back to the coarsest ladder step for spans wider
 * than the ladder covers, and to the finest step for a zero-width span.
 */
export function computeBucketDuration(minTimeMs: number, maxTimeMs: number): number {
  const span = Math.max(0, maxTimeMs - minTimeMs);
  if (span === 0) return BUCKET_DURATION_LADDER_MS[0];

  const fitting = BUCKET_DURATION_LADDER_MS.find(
    (candidate) => span / candidate <= MAX_BUCKET_COUNT,
  );
  return fitting ?? BUCKET_DURATION_LADDER_MS[BUCKET_DURATION_LADDER_MS.length - 1];
}
