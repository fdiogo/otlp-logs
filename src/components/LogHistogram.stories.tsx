import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogHistogram } from "./LogHistogram";
import type { HistogramServiceGroup } from "./LogHistogram";

const BASE_TIME = Date.UTC(2024, 3, 1, 12, 0, 0);

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

/** Generates sparse, irregularly-spaced log timestamps across `spanMs`. */
function buildRecords(spanMs: number, recordCount: number, seed: number) {
  const random = mulberry32(seed);
  return Array.from({ length: recordCount }, () => ({
    timeUnixNano: (
      BigInt(BASE_TIME + Math.floor(random() * spanMs)) * BigInt(1_000_000)
    ).toString(),
  }));
}

/**
 * Same idea as `buildRecords`, but spread across a handful of named service groups
 * (descending by volume, as `groupLogRecordsByService` produces) to exercise the stacked variant.
 */
function buildServiceGroups(
  spanMs: number,
  groupRecordCounts: [label: string, count: number][],
  seed: number,
): HistogramServiceGroup[] {
  const random = mulberry32(seed);
  return groupRecordCounts.map(([label, count]) => ({
    key: label,
    label,
    logRecords: Array.from({ length: count }, () => ({
      timeUnixNano: (
        BigInt(BASE_TIME + Math.floor(random() * spanMs)) * BigInt(1_000_000)
      ).toString(),
    })),
  }));
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
    logRecords: buildRecords(5 * 60_000, 46, 1),
  },
};

export const Stacked: Story = {
  args: {
    variant: "stacked",
    serviceGroups: buildServiceGroups(
      5 * 60_000,
      [
        ["checkout", 21],
        ["billing", 13],
        ["auth", 6],
      ],
      10,
    ),
  },
};

export const Empty: Story = {
  args: {
    logRecords: [],
  },
};

// The stories below feed sparse, unbucketed timestamps at a range of time spans, to show
// bucket width adapting to keep the bar count readable instead of staying fixed.

export const DynamicBucketing15Minutes: Story = {
  name: "Dynamic bucketing — 15 minute span (15s buckets)",
  args: {
    logRecords: buildRecords(15 * 60_000, 120, 1),
  },
};

export const DynamicBucketing6Hours: Story = {
  name: "Dynamic bucketing — 6 hour span (5m buckets)",
  args: {
    logRecords: buildRecords(6 * 60 * 60_000, 400, 2),
  },
};

export const DynamicBucketing1Day: Story = {
  name: "Dynamic bucketing — 1 day span (30m buckets)",
  args: {
    logRecords: buildRecords(24 * 60 * 60_000, 500, 3),
  },
};

export const DynamicBucketing2Weeks: Story = {
  name: "Dynamic bucketing — 2 week span (5h buckets)",
  args: {
    logRecords: buildRecords(14 * 24 * 60 * 60_000, 600, 4),
  },
};

// The stories below do the same, but for the stacked/"group by service" variant.

export const DynamicBucketingStacked15Minutes: Story = {
  name: "Dynamic bucketing (stacked) — 15 minute span (15s buckets)",
  args: {
    variant: "stacked",
    serviceGroups: buildServiceGroups(
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
    serviceGroups: buildServiceGroups(
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
    serviceGroups: buildServiceGroups(
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
    serviceGroups: buildServiceGroups(
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
    logRecords: buildRecords(5 * 60_000, 46, 1),
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
