import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { useState } from "react";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Design System/Checkbox",
  component: Checkbox,
  tags: ["ai-generated"],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: { checked: false, label: "Group by service" },
};

export const Checked: Story = {
  args: { checked: true, label: "Group by service" },
};

export const Toggle: Story = {
  render: function Render(args) {
    const [checked, setChecked] = useState(args.checked);
    return <Checkbox {...args} checked={checked} onChange={setChecked} />;
  },
  args: { checked: false, label: "Group by service" },
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
