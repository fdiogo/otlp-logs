import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogHistogram } from "./LogHistogram";
import type { LogHistogramBucket, StackedHistogramBucket } from "./types";
import { bucketLogRecords } from "@/queries/bucketLogRecords";
import { bucketLogRecordsByService } from "@/queries/bucketLogRecordsByService";
import { computeBucketDuration } from "@/queries/computeBucketDuration";
import type { ServiceGroup } from "@/queries/serviceGroup";

const BUCKET_DURATION_MS = 60_000;
const BASE_TIME = Date.UTC(2024, 3, 1, 12, 0, 0);

function flatBucket(minute: number, count: number): LogHistogramBucket {
  return { time: BASE_TIME + minute * BUCKET_DURATION_MS, count };
}

const flatBuckets: LogHistogramBucket[] = [
  flatBucket(0, 4),
  flatBucket(1, 12),
  flatBucket(2, 7),
  flatBucket(3, 20),
  flatBucket(4, 3),
];

const series = [
  { key: "checkout", label: "checkout" },
  { key: "billing", label: "billing" },
  { key: "auth", label: "auth" },
];

function stackedBucket(minute: number, counts: Record<string, number>): StackedHistogramBucket {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { time: BASE_TIME + minute * BUCKET_DURATION_MS, total, counts };
}

const stackedBuckets: StackedHistogramBucket[] = [
  stackedBucket(0, { checkout: 3, billing: 1, auth: 0 }),
  stackedBucket(1, { checkout: 8, billing: 2, auth: 1 }),
  stackedBucket(2, { checkout: 2, billing: 4, auth: 2 }),
  stackedBucket(3, { checkout: 10, billing: 6, auth: 3 }),
];

/** Deterministic PRNG so the synthetic "sparse logs" stories render the same bars every run. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates sparse, irregularly-spaced log timestamps across `spanMs`, then buckets them
 * with the *actual* dynamic bucket width — this is what makes these stories demonstrate the
 * fix, rather than pre-bucketed fixtures like `flatBuckets` above.
 */
function buildDynamicBuckets(spanMs: number, recordCount: number, seed: number) {
  const random = mulberry32(seed);
  const startTime = BASE_TIME;
  const records = Array.from({ length: recordCount }, () => ({
    timeUnixNano: (
      BigInt(startTime + Math.floor(random() * spanMs)) * BigInt(1_000_000)
    ).toString(),
  }));
  const bucketDurationMs = computeBucketDuration(startTime, startTime + spanMs);
  return { buckets: bucketLogRecords(records, bucketDurationMs), bucketDurationMs };
}

/**
 * Same idea as `buildDynamicBuckets`, but spread across a handful of named service groups
 * (descending by volume, as `groupLogRecordsByService` produces) to exercise the stacked variant.
 */
function buildDynamicStackedBuckets(
  spanMs: number,
  groupRecordCounts: [label: string, count: number][],
  seed: number,
) {
  const random = mulberry32(seed);
  const startTime = BASE_TIME;
  const serviceGroups: ServiceGroup[] = groupRecordCounts.map(([label, count]) => ({
    key: label,
    label,
    logRecords: Array.from({ length: count }, () => ({
      timeUnixNano: (
        BigInt(startTime + Math.floor(random() * spanMs)) * BigInt(1_000_000)
      ).toString(),
    })) as ServiceGroup["logRecords"],
  }));
  const bucketDurationMs = computeBucketDuration(startTime, startTime + spanMs);
  return { ...bucketLogRecordsByService(serviceGroups, bucketDurationMs), bucketDurationMs };
}

const meta = {
  title: "Components/LogHistogram",
  component: LogHistogram,
  tags: ["ai-generated"],
} satisfies Meta<typeof LogHistogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Flat: Story = {
  args: {
    buckets: flatBuckets,
    bucketDurationMs: BUCKET_DURATION_MS,
  },
};

export const Stacked: Story = {
  args: {
    variant: "stacked",
    buckets: stackedBuckets,
    series,
    bucketDurationMs: BUCKET_DURATION_MS,
  },
};

export const Empty: Story = {
  args: {
    buckets: [],
    bucketDurationMs: BUCKET_DURATION_MS,
  },
};

// The stories below feed sparse, unbucketed timestamps through the real
// `computeBucketDuration` + `bucketLogRecords` pipeline, at a range of time spans, to show
// bucket width adapting to keep the bar count readable instead of staying fixed at 1 minute.

export const DynamicBucketing15Minutes: Story = {
  name: "Dynamic bucketing — 15 minute span (15s buckets)",
  args: {
    ...buildDynamicBuckets(15 * 60_000, 120, 1),
  },
};

export const DynamicBucketing6Hours: Story = {
  name: "Dynamic bucketing — 6 hour span (5m buckets)",
  args: {
    ...buildDynamicBuckets(6 * 60 * 60_000, 400, 2),
  },
};

export const DynamicBucketing1Day: Story = {
  name: "Dynamic bucketing — 1 day span (30m buckets)",
  args: {
    ...buildDynamicBuckets(24 * 60 * 60_000, 500, 3),
  },
};

export const DynamicBucketing2Weeks: Story = {
  name: "Dynamic bucketing — 2 week span (5h buckets)",
  args: {
    ...buildDynamicBuckets(14 * 24 * 60 * 60_000, 600, 4),
  },
};

// The stories below do the same, but for the stacked/"group by service" variant, since
// `app/page.tsx` computes one bucket width from the full record set and reuses it for
// both `bucketLogRecords` (flat) and `bucketLogRecordsByService` (stacked).

export const DynamicBucketingStacked15Minutes: Story = {
  name: "Dynamic bucketing (stacked) — 15 minute span (15s buckets)",
  args: {
    variant: "stacked",
    ...buildDynamicStackedBuckets(
      15 * 60_000,
      [
        ["checkout", 60],
        ["billing", 30],
        ["auth", 15],
      ],
      11,
    ),
  },
};

export const DynamicBucketingStacked6Hours: Story = {
  name: "Dynamic bucketing (stacked) — 6 hour span (5m buckets)",
  args: {
    variant: "stacked",
    ...buildDynamicStackedBuckets(
      6 * 60 * 60_000,
      [
        ["checkout", 200],
        ["billing", 120],
        ["auth", 80],
      ],
      12,
    ),
  },
};

export const DynamicBucketingStacked1Day: Story = {
  name: "Dynamic bucketing (stacked) — 1 day span (30m buckets)",
  args: {
    variant: "stacked",
    ...buildDynamicStackedBuckets(
      24 * 60 * 60_000,
      [
        ["checkout", 250],
        ["billing", 150],
        ["auth", 100],
      ],
      13,
    ),
  },
};

export const DynamicBucketingStacked2Weeks: Story = {
  name: "Dynamic bucketing (stacked) — 2 week span (5h buckets)",
  args: {
    variant: "stacked",
    ...buildDynamicStackedBuckets(
      14 * 24 * 60 * 60_000,
      [
        ["checkout", 300],
        ["billing", 180],
        ["auth", 120],
      ],
      14,
    ),
  },
};

// LogHistogram wraps its chart in `className="rounded-lg ..."` — this only resolves to a
// non-zero border radius if Tailwind's stylesheet loaded.
export const CssCheck: Story = {
  args: {
    buckets: flatBuckets,
    bucketDurationMs: BUCKET_DURATION_MS,
  },
  play: async ({ canvasElement }) => {
    const panel = await new Promise<Element>((resolve) => {
      const check = () => {
        const el = canvasElement.querySelector(".recharts-responsive-container")?.parentElement;
        if (el) resolve(el);
        else requestAnimationFrame(check);
      };
      check();
    });
    // rounded-lg resolves to this value under Tailwind v4 — fails if the stylesheet didn't load.
    await expect(getComputedStyle(panel).borderRadius).toBe("8px");
  },
};
