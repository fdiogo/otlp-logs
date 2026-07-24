"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnyValue, KeyValue, LogRecord } from "@/queries/logsQuery";
import { Time } from "@/design-system/Time";
import { Badge } from "@/design-system/Badge";

export type LogRecordWithResource = LogRecord & { resourceLabel?: string };

export interface ServiceGroup {
  /** Stable identity: service.namespace + service.name, namespace omitted when unset. */
  key: string;
  label: string;
  logRecords: LogRecord[];
}

type LogRecordsTableProps = { logRecords: LogRecordWithResource[] } | { groups: ServiceGroup[] };

function isGrouped(props: LogRecordsTableProps): props is { groups: ServiceGroup[] } {
  return "groups" in props;
}

type Row =
  | { type: "header"; rowKey: string; group: ServiceGroup; collapsed: boolean }
  | { type: "log"; rowKey: string; log: LogRecordWithResource }
  | { type: "detail"; rowKey: string; log: LogRecordWithResource };

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

function severityTone(log: LogRecordWithResource): "error" | "warn" | "neutral" | "info" {
  const rank = severityRank(log);
  if (rank >= 17) return "error";
  if (rank >= 13) return "warn";
  if (rank < 9) return "neutral";
  return "info";
}

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

export function LogRecordsTable(props: LogRecordsTableProps) {
  const grouped = isGrouped(props);
  const groups = grouped ? props.groups : undefined;
  const logRecords = grouped ? undefined : props.logRecords;

  // Groups start collapsed so the initial row list stays bounded regardless of dataset size.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(groups?.map((group) => group.key)),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleExpanded(rowKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  const rows: Row[] = useMemo(() => {
    if (!groups) {
      const result: Row[] = [];
      for (const [index, log] of (logRecords ?? []).entries()) {
        const rowKey = `log:${index}`;
        result.push({ type: "log", rowKey, log });
        if (expanded.has(rowKey)) {
          result.push({ type: "detail", rowKey: `detail:${index}`, log });
        }
      }
      return result;
    }
    const result: Row[] = [];
    for (const group of groups) {
      const collapsed = collapsedGroups.has(group.key);
      result.push({ type: "header", rowKey: `header:${group.key}`, group, collapsed });
      if (!collapsed) {
        for (const [index, rawLog] of group.logRecords.entries()) {
          const rowKey = `log:${group.key}:${index}`;
          const log = { ...rawLog, resourceLabel: group.label };
          result.push({ type: "log", rowKey, log });
          if (expanded.has(rowKey)) {
            result.push({ type: "detail", rowKey: `detail:${group.key}:${index}`, log });
          }
        }
      }
    }
    return result;
  }, [groups, logRecords, collapsedGroups, expanded]);

  const columnCount = grouped ? 3 : 4;

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index].rowKey,
    estimateSize: (index) => {
      const type = rows[index]?.type;
      if (type === "header") return 37;
      if (type === "detail") return 160;
      return 57;
    },
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={scrollRef} className="h-150 overflow-auto rounded-lg border border-panel-border bg-panel">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-panel-header">
          <tr>
            {!grouped && (
              <th className="w-px whitespace-nowrap border-b border-panel-border px-3 py-2 font-medium text-panel-muted">
                Resource
              </th>
            )}
            <th className="w-px whitespace-nowrap border-b border-panel-border px-3 py-2 font-medium text-panel-muted">
              Severity
            </th>
            <th className="w-px whitespace-nowrap border-b border-panel-border px-3 py-2 font-medium text-panel-muted">
              Time
            </th>
            <th className="border-b border-panel-border px-3 py-2 font-medium text-panel-muted">Body</th>
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];

            if (row.type === "header") {
              return (
                <tr key={row.rowKey} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                  <td colSpan={columnCount} className="!p-0">
                    <button
                      onClick={() => toggleGroup(row.group.key)}
                      className="flex w-full items-center gap-2 border-b border-panel-border bg-panel-header px-3 py-2 text-left text-sm font-medium hover:bg-panel-border-subtle"
                    >
                      <span className="w-3 shrink-0">{row.collapsed ? "▸" : "▾"}</span>
                      <span>{row.group.label}</span>
                      <span className="text-panel-subtle">({row.group.logRecords.length})</span>
                    </button>
                  </td>
                </tr>
              );
            }

            if (row.type === "detail") {
              return (
                <tr key={row.rowKey} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                  <td
                    colSpan={columnCount}
                    className="border-b border-panel-border-subtle bg-panel-header px-3 py-2"
                  >
                    <div className="rounded-lg border border-panel-border bg-panel p-3">
                      <h4 className="text-xs font-medium text-panel-muted">Body</h4>
                      <hr className="border-panel-border-subtle my-1" />
                      <p className="mt-2 whitespace-pre-wrap wrap-break-word text-xs text-panel-muted">
                        {renderAnyValue(row.log.body)}
                      </p>
                    </div>
                    <div className="mt-2">
                      <AttributesTable attributes={row.log.attributes ?? []} />
                    </div>
                  </td>
                </tr>
              );
            }

            const log = row.log;
            const tone = severityTone(log);
            return (
              <tr
                key={row.rowKey}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                onClick={() => toggleExpanded(row.rowKey)}
                className="cursor-pointer align-top [&>td]:border-b [&>td]:border-panel-border-subtle [&>td]:px-3 [&>td]:py-2 hover:bg-panel-header"
              >
                {!grouped && (
                  <td className="w-px whitespace-nowrap align-top font-medium text-panel-muted">
                    {log.resourceLabel}
                  </td>
                )}
                <td className="w-px whitespace-nowrap align-top">
                  <Badge tone={tone}>{severityLabel(log)}</Badge>
                </td>
                <td className="w-px whitespace-nowrap align-top font-mono text-xs text-panel-muted">
                  <Time unixNano={log.timeUnixNano} />
                </td>
                <td className="align-top">
                  <p title={renderAnyValue(log.body)} className="line-clamp-2 break-words">
                    {renderAnyValue(log.body)}
                  </p>
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
