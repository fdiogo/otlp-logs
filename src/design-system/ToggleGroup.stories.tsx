import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { useState } from "react";
import { Group, List } from "lucide-react";
import { ToggleGroup } from "./ToggleGroup";

const meta = {
  title: "Design System/ToggleGroup",
  component: ToggleGroup,
  tags: ["ai-generated"],
  args: {
    onChange: fn(),
    options: [
      { value: "flat", label: "Flat", icon: List },
      { value: "grouped", label: "Grouped", icon: Group },
    ],
  },
} satisfies Meta<typeof ToggleGroup<"flat" | "grouped">>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Flat: Story = {
  args: { value: "flat" },
};

export const Grouped: Story = {
  args: { value: "grouped" },
};

export const Toggle: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ToggleGroup {...args} value={value} onChange={setValue} />;
  },
  args: { value: "flat" },
  play: async ({ canvas, userEvent }) => {
    const grouped = canvas.getByRole("radio", { name: "Grouped" });
    await expect(grouped).toHaveAttribute("aria-checked", "false");
    await userEvent.click(grouped);
    await expect(grouped).toHaveAttribute("aria-checked", "true");
  },
};
