import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./page";
import type { ExportLogsServiceRequest } from "@/app/generated/opentelemetry/proto/collector/logs/v1/logs_service";
import type { LogRecord } from "@/app/generated/opentelemetry/proto/logs/v1/logs";

const BASE_TIME_MS = Date.UTC(2024, 3, 1, 12, 0, 0);
const MINUTE_NS = BigInt(60_000_000_000);
const BASE_TIME_NS = BigInt(BASE_TIME_MS) * BigInt(1_000_000);

function logRecord(
  minute: number,
  severityText: string,
  body: string,
  attributes: Record<string, string> = {},
): LogRecord {
  return {
    timeUnixNano: (BASE_TIME_NS + MINUTE_NS * BigInt(minute)).toString(),
    severityText,
    body: { stringValue: body },
    attributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      value: { stringValue: value },
    })),
  };
}

function service(name: string, records: LogRecord[]) {
  return {
    resource: {
      attributes: [{ key: "service.name", value: { stringValue: name } }],
    },
    scopeLogs: [{ logRecords: records }],
  };
}

const mockLogs: ExportLogsServiceRequest = {
  resourceLogs: [
    service("checkout", [
      logRecord(0, "INFO", "checkout started", { "order.id": "ord_1" }),
      logRecord(0, "INFO", "payment authorized", { "order.id": "ord_1" }),
      logRecord(1, "ERROR", "payment failed", { "order.id": "ord_2", reason: "card_declined" }),
      logRecord(2, "INFO", "checkout started", { "order.id": "ord_3" }),
      logRecord(3, "INFO", "checkout completed", { "order.id": "ord_1" }),
      logRecord(4, "WARN", "retrying payment provider", { "order.id": "ord_3" }),
    ]),
    service("billing", [
      logRecord(0, "INFO", "invoice generated", { "invoice.id": "inv_1" }),
      logRecord(1, "INFO", "invoice generated", { "invoice.id": "inv_2" }),
      logRecord(2, "ERROR", "invoice delivery failed", { "invoice.id": "inv_2" }),
      logRecord(3, "INFO", "invoice paid", { "invoice.id": "inv_1" }),
    ]),
    service("auth", [
      logRecord(1, "INFO", "user logged in", { "user.id": "u_42" }),
      logRecord(2, "WARN", "repeated failed login", { "user.id": "u_7" }),
      logRecord(3, "INFO", "user logged in", { "user.id": "u_8" }),
      logRecord(4, "ERROR", "token refresh failed", { "user.id": "u_7" }),
      logRecord(4, "INFO", "user logged out", { "user.id": "u_42" }),
    ]),
  ],
};

function makeQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false },
    },
  });
  queryClient.setQueryData(["logs"], mockLogs);
  return queryClient;
}

const meta = {
  component: Home,
  tags: ["ai-generated"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

// The whole Logs page, flat list, with mocked data — use this to iterate on
// overall look and feel without needing the real API.
export const FlatList: Story = {};

export const GroupedByService: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { query: { groupBy: "service" } },
    },
  },
};
