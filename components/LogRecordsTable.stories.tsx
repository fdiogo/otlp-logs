import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogRecordsTable } from "./LogRecordsTable";
import type { LogRecord } from "@/app/generated/opentelemetry/proto/logs/v1/logs";

function logRecord(overrides: Partial<LogRecord>): LogRecord {
  return {
    timeUnixNano: "1712000000000000000",
    severityText: "INFO",
    body: { stringValue: "request completed" },
    attributes: [],
    ...overrides,
  };
}

const logRecords: LogRecord[] = [
  logRecord({
    severityText: "INFO",
    body: { stringValue: "user logged in" },
    attributes: [{ key: "user.id", value: { stringValue: "42" } }],
  }),
  logRecord({
    severityText: "ERROR",
    body: { stringValue: "payment failed" },
    attributes: [{ key: "order.id", value: { stringValue: "ord_123" } }],
  }),
  logRecord({
    severityText: "WARN",
    body: { stringValue: "retrying request" },
  }),
];

const meta = {
  component: LogRecordsTable,
  tags: ["ai-generated"],
} satisfies Meta<typeof LogRecordsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { logRecords },
};

export const Empty: Story = {
  args: { logRecords: [] },
};

// Clicking a row reveals its attributes.
export const ExpandRow: Story = {
  args: { logRecords },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText(/payment failed/));
    await expect(await canvas.findByText(/order.id/)).toBeVisible();
  },
};
