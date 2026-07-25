import { queryOptions } from "@tanstack/react-query";

interface KeyValue {
  key?: string;
  value?: AnyValue;
}

interface AnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string;
  doubleValue?: number;
  arrayValue?: { values?: AnyValue[] };
  kvlistValue?: { values?: KeyValue[] };
  bytesValue?: Uint8Array;
}

interface InstrumentationScope {
  name?: string;
  version?: string;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

interface Resource {
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

interface LogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
  flags?: number;
  traceId?: Uint8Array;
  spanId?: Uint8Array;
  eventName?: string;
}

interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords?: LogRecord[];
  schemaUrl?: string;
}

interface ResourceLogs {
  resource?: Resource;
  scopeLogs?: ScopeLogs[];
  schemaUrl?: string;
}

/**
 * This type was auto-generated using ts-proto
 */
interface ExportLogsServiceRequest {
  resourceLogs?: ResourceLogs[];
}

export const logsQuery = queryOptions({
  queryKey: ["logs"],
  staleTime: Infinity,
  queryFn: async ({ signal }) => {
    {
      const res = await fetch(
        "https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs",
        { signal },
      );
      const json: ExportLogsServiceRequest = await res.json();

      return json;
    }
  },
});
