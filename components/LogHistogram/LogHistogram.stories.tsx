import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogHistogram } from "./LogHistogram";
import type { LogHistogramBucket, StackedHistogramBucket } from "./types";

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

const meta = {
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
