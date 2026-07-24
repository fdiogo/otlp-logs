import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ServiceGroupSection } from "./ServiceGroupSection";
import type { ServiceGroup } from "@/queries/serviceGroup";
import type { LogRecord } from "@/app/generated/opentelemetry/proto/logs/v1/logs";

const logRecords: LogRecord[] = [
  {
    timeUnixNano: "1712000000000000000",
    severityText: "INFO",
    body: { stringValue: "checkout started" },
    attributes: [],
  },
  {
    timeUnixNano: "1712000001000000000",
    severityText: "ERROR",
    body: { stringValue: "checkout failed" },
    attributes: [],
  },
];

const group: ServiceGroup = {
  key: "checkout",
  label: "checkout",
  logRecords,
};

const meta = {
  component: ServiceGroupSection,
  tags: ["ai-generated"],
} satisfies Meta<typeof ServiceGroupSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: { group },
};

export const Collapsed: Story = {
  args: { group },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /checkout/i }));
    await expect(canvas.queryByText("checkout started")).not.toBeInTheDocument();
  },
};
