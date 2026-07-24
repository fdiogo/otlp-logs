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

function severityRank(log: LogRecordWithResource): number {
  if (typeof log.severityNumber === "number") return log.severityNumber;
  const text = log.severityText?.toUpperCase() ?? "";
  if (text.startsWith("ERROR") || text.startsWith("FATAL")) return 17;
  if (text.startsWith("WARN")) return 13;
  if (text.startsWith("DEBUG")) return 5;
  return 9;
}

function severityLabel(log: LogRecordWithResource): string {
  return log.severityText ?? String(log.severityNumber ?? "");
}

function severityTone(log: LogRecordWithResource): "error" | "warn" | "debug" | "info" {
  const rank = severityRank(log);
  if (rank >= 17) return "error";
  if (rank >= 13) return "warn";
  if (rank < 9) return "debug";
  return "info";
}

const SEVERITY_BADGE: Record<string, string> = {
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  debug: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
};

function AttributesTable({ attributes }: { attributes: KeyValue[] }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-3">
      <h4 className="text-xs font-medium text-panel-muted">Attributes</h4>
      <hr className="border-panel-border-subtle my-1" />
      {attributes.length === 0 ? (
        <p className="mt-2 text-xs italic text-panel-subtle">No attributes</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {attributes.map((attribute, index) => (
            <div key={attribute.key ?? index} className="font-mono text-xs">
              <div className="text-panel-subtle">{attribute.key}</div>
              <div className="whitespace-pre-wrap break-all text-panel-muted">
                {renderAnyValue(attribute.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    estimateSize: () => 41,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={scrollRef} className="h-[600px] overflow-auto rounded-lg border border-panel-border bg-panel">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-panel-header">
          <tr>
            <th className="w-[20%] border-b border-panel-border px-3 py-2 font-medium text-panel-muted">Resource</th>
            <th className="w-[15%] border-b border-panel-border px-3 py-2 font-medium text-panel-muted">Severity</th>
            <th className="w-[20%] border-b border-panel-border px-3 py-2 font-medium text-panel-muted">Time</th>
            <th className="w-[45%] border-b border-panel-border px-3 py-2 font-medium text-panel-muted">Body</th>
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
            const tone = severityTone(log);
            const isExpanded = expanded.has(index);
            return (
              <tr
                key={index}
                ref={rowVirtualizer.measureElement}
                data-index={index}
                className="[&>td]:align-top [&>td]:border-b [&>td]:border-panel-border-subtle [&>td]:px-3 [&>td]:py-2"
              >
                <td colSpan={4} className="!p-0">
                  <div
                    onClick={() => toggleExpanded(index)}
                    className="flex cursor-pointer items-start gap-0 hover:bg-panel-header"
                  >
                    <div className="w-[20%] shrink-0 px-3 py-2 font-medium text-panel-muted">
                      {log.resourceLabel}
                    </div>
                    <div className="w-[15%] shrink-0 px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[tone]}`}>
                        {severityLabel(log)}
                      </span>
                    </div>
                    <div className="w-[20%] shrink-0 whitespace-nowrap px-3 py-2 font-mono text-xs text-panel-muted">
                      <Time unixNano={log.timeUnixNano} />
                    </div>
                    <div className="min-w-0 flex-1 px-3 py-2">{renderAnyValue(log.body)}</div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-panel-border-subtle bg-panel-header px-3 py-2">
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
