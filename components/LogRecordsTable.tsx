"use client";

import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: logRecords.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 37,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={scrollRef} className="h-[600px] overflow-auto">
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
          {paddingTop > 0 && (
            <tr>
              <td colSpan={4} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const index = virtualRow.index;
            const log = logRecords[index];
            return (
              <tr
                key={index}
                ref={rowVirtualizer.measureElement}
                data-index={index}
                onClick={() => toggleExpanded(index)}
                className="cursor-pointer hover:bg-black/5 [&>td]:align-top"
              >
                <td className="border-b p-2">{log.resourceLabel}</td>
                <td className="border-b p-2">{log.severityText ?? log.severityNumber}</td>
                <td className="border-b p-2">
                  <Time unixNano={log.timeUnixNano} />
                </td>
                <td className="border-b p-2">
                  {renderAnyValue(log.body)}
                  {expanded.has(index) && (
                    <div className="mt-2 bg-black/2 p-2">
                      <AttributesTable attributes={log.attributes ?? []} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={4} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
