import { queryOptions } from "@tanstack/react-query";

export interface KeyValue {
  key?: string;
  value?: AnyValue;
}

export interface AnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string;
  doubleValue?: number;
  arrayValue?: { values?: AnyValue[] };
  kvlistValue?: { values?: KeyValue[] };
  bytesValue?: Uint8Array;
}

export interface InstrumentationScope {
  name?: string;
  version?: string;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface Resource {
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface LogRecord {
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

export interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords?: LogRecord[];
  schemaUrl?: string;
}

export interface ResourceLogs {
  resource?: Resource;
  scopeLogs?: ScopeLogs[];
  schemaUrl?: string;
}

export interface ExportLogsServiceRequest {
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
