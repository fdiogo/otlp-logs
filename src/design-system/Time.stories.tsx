import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Time } from "./Time";

const meta = {
  title: "Design System/Time",
  component: Time,
  tags: ["ai-generated"],
} satisfies Meta<typeof Time>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { unixNano: "1712000000000000000" },
};

export const Undefined: Story = {
  args: { unixNano: undefined },
};
