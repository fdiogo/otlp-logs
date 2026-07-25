import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogRecordsTable } from "./LogRecordsTable";

type LogItem = ComponentProps<typeof LogRecordsTable>["items"][number];

function logItem(overrides: Partial<LogItem>): LogItem {
  return {
    groupKey: "checkout",
    timeUnixNano: "1712000000000000000",
    severityText: "INFO",
    body: "request completed",
    attributes: [],
    ...overrides,
  };
}

const items: LogItem[] = [
  logItem({
    groupKey: "auth",
    severityText: "INFO",
    body: "user logged in",
    attributes: [{ key: "user.id", value: "42" }],
  }),
  logItem({
    groupKey: "checkout",
    severityText: "ERROR",
    body: "payment failed",
    attributes: [
      { key: "order.id", value: "ord_123" },
      { key: "amount.cents", value: "4999" },
      { key: "retryable", value: "true" },
      { key: "latency.ms", value: "812.4" },
      { key: "gateway.response", value: "{code: card_declined}" },
    ],
  }),
  logItem({
    groupKey: "checkout",
    severityText: "WARN",
    body: "retrying request",
  }),
];

const meta = {
  title: "Components/LogRecordsTable",
  component: LogRecordsTable,
  tags: ["ai-generated"],
} satisfies Meta<typeof LogRecordsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { items, variant: "flat" },
};

export const Empty: Story = {
  args: { items: [], variant: "flat" },
};

// Clicking a row reveals its attributes.
export const ExpandRow: Story = {
  args: { items, variant: "flat" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText(/payment failed/));
    await expect(await canvas.findByText(/order.id/)).toBeVisible();
  },
};

// Groups start collapsed: only header rows with counts are visible.
export const Grouped: Story = {
  args: { items, variant: "grouped" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("checkout")).toBeVisible();
    await expect(canvas.getByText("(2)")).toBeVisible();
    await expect(canvas.queryByText("payment failed")).not.toBeInTheDocument();
  },
};

// Expanding a group inserts its log rows into the same virtualized list.
export const GroupedExpanded: Story = {
  args: { items, variant: "grouped" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /checkout/i }));
    await expect(await canvas.findByText("payment failed")).toBeVisible();
    await expect(canvas.queryByText("user logged in")).not.toBeInTheDocument();
  },
};
