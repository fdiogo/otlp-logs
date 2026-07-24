import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Histogram } from "./Histogram";
import type { HistogramProps } from "./Histogram";

const BASE_TIME = Date.UTC(2024, 3, 1, 12, 0, 0);

/** Deterministic PRNG so stories render the same bars every run. */
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

function buildItems(spanMs: number, count: number, seed: number): HistogramProps["items"] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    timeUnixNano: (BigInt(BASE_TIME + Math.floor(random() * spanMs)) * BigInt(1_000_000)).toString(),
  }));
}

function buildGroupedItems(spanMs: number, groups: [groupKey: string, count: number][], seed: number): HistogramProps["items"] {
  const random = mulberry32(seed);
  return groups.flatMap(([groupKey, count]) =>
    Array.from({ length: count }, () => ({
      timeUnixNano: (BigInt(BASE_TIME + Math.floor(random() * spanMs)) * BigInt(1_000_000)).toString(),
      groupKey,
    })),
  );
}

const meta = {
  title: "Design System/Histogram",
  component: Histogram,
  tags: ["ai-generated"],
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Flat: Story = {
  args: {
    items: buildItems(5 * 60_000, 46, 1),
  },
};

export const Stacked: Story = {
  args: {
    items: buildGroupedItems(
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
    items: [],
  },
};
