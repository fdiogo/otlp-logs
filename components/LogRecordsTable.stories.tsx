import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LogRecordsTable, type LogRecordWithResource } from "./LogRecordsTable";
import manyLogRecords from "./fixtures/logRecords.json";

function logRecord(overrides: Partial<LogRecordWithResource>): LogRecordWithResource {
  return {
    timeUnixNano: "1712000000000000000",
    severityText: "INFO",
    body: { stringValue: "request completed" },
    attributes: [],
    resourceLabel: "checkout",
    ...overrides,
  };
}

const logRecords: LogRecordWithResource[] = [
  logRecord({
    severityText: "INFO",
    body: { stringValue: "user logged in" },
    attributes: [{ key: "user.id", value: { stringValue: "42" } }],
    resourceLabel: "auth",
  }),
  logRecord({
    severityText: "ERROR",
    body: { stringValue: "payment failed" },
    attributes: [{ key: "order.id", value: { stringValue: "ord_123" } }],
    resourceLabel: "checkout",
  }),
  logRecord({
    severityText: "WARN",
    body: { stringValue: "retrying request" },
    resourceLabel: "checkout",
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

// Real-world dataset captured from the take-home assignment API, used to sanity-check
// rendering performance and layout with thousands of rows.
export const ManyRows: Story = {
  args: { logRecords: manyLogRecords as LogRecordWithResource[] },
};
