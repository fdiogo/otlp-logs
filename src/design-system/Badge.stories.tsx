import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Design System/Badge",
  component: Badge,
  tags: ["ai-generated"],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { tone: "neutral", children: "DEBUG" },
};

export const Info: Story = {
  args: { tone: "info", children: "INFO" },
};

export const Warn: Story = {
  args: { tone: "warn", children: "WARN" },
};

export const Error: Story = {
  args: { tone: "error", children: "ERROR" },
};
