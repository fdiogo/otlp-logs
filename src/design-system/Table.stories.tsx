import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Table } from "./Table";
import { Badge } from "./Badge";

const meta = {
  title: "Design System/Table",
  component: Table,
  tags: ["ai-generated"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head className="w-px whitespace-nowrap">Severity</Table.Head>
          <Table.Head>Message</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell className="w-px whitespace-nowrap">
            <Badge tone="info">INFO</Badge>
          </Table.Cell>
          <Table.Cell>Server started on port 3000</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell className="w-px whitespace-nowrap">
            <Badge tone="error">ERROR</Badge>
          </Table.Cell>
          <Table.Cell>Failed to connect to database</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};
