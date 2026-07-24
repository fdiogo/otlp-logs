"use client";

import { Fragment, useState } from "react";
import type { AnyValue, KeyValue } from "@/app/generated/opentelemetry/proto/common/v1/common";
import type { LogRecord } from "@/app/generated/opentelemetry/proto/logs/v1/logs";
import { Time } from "./Time";

export type LogRecordWithResource = LogRecord & { resourceLabel?: string };

function renderAnyValue(value: AnyValue | undefined): string {
  if (value === undefined) return "";
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return String(value.boolValue);
  if (value.intValue !== undefined) return value.intValue;
  if (value.doubleValue !== undefined) return String(value.doubleValue);
  if (value.bytesValue !== undefined) return Buffer.from(value.bytesValue).toString("base64");
  if (value.arrayValue !== undefined) {
    return `[${value.arrayValue.values?.map(renderAnyValue).join(", ") ?? ""}]`;
  }
  if (value.kvlistValue !== undefined) {
    return `{${
      value.kvlistValue.values?.map((kv) => `${kv.key}: ${renderAnyValue(kv.value)}`).join(", ") ?? ""
    }}`;
  }
  return "";
}

function attributeValueType(value: AnyValue | undefined): string {
  if (value === undefined) return "empty";
  if (value.stringValue !== undefined) return "string";
  if (value.boolValue !== undefined) return "bool";
  if (value.intValue !== undefined) return "int";
  if (value.doubleValue !== undefined) return "double";
  if (value.bytesValue !== undefined) return "bytes";
  if (value.arrayValue !== undefined) return "array";
  if (value.kvlistValue !== undefined) return "kvlist";
  return "empty";
}

function AttributesTable({ attributes }: { attributes: KeyValue[] }) {
  if (attributes.length === 0) {
    return <p className="text-xs italic text-black/50">No attributes</p>;
  }

  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr>
          <th className="border-b p-1 pr-4 font-medium text-black/60">Key</th>
          <th className="border-b p-1 pr-4 font-medium text-black/60">Value</th>
          <th className="border-b p-1 font-medium text-black/60">Type</th>
        </tr>
      </thead>
      <tbody>
        {attributes.map((attribute, index) => (
          <tr key={attribute.key ?? index}>
            <td className="border-b p-1 pr-4 align-top font-mono">{attribute.key}</td>
            <td className="border-b p-1 pr-4 align-top font-mono whitespace-pre-wrap break-all">
              {renderAnyValue(attribute.value)}
            </td>
            <td className="border-b p-1 align-top text-black/50">{attributeValueType(attribute.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LogRecordsTable({ logRecords }: { logRecords: LogRecordWithResource[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          <th className="border-b p-2">Resource</th>
          <th className="border-b p-2">Severity</th>
          <th className="border-b p-2">Time</th>
          <th className="border-b p-2">Body</th>
        </tr>
      </thead>
      <tbody>
        {logRecords.map((log, index) => (
          <Fragment key={index}>
            <tr
              onClick={() => toggleExpanded(index)}
              className="cursor-pointer hover:bg-black/5"
            >
              <td className="border-b p-2">{log.resourceLabel}</td>
              <td className="border-b p-2">{log.severityText ?? log.severityNumber}</td>
              <td className="border-b p-2">
                <Time unixNano={log.timeUnixNano} />
              </td>
              <td className="border-b p-2">{renderAnyValue(log.body)}</td>
            </tr>
            {expanded.has(index) && (
              <tr>
                <td colSpan={4} className="border-b bg-black/2 p-2">
                  <AttributesTable attributes={log.attributes ?? []} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
