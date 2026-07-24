"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnyValue } from "@/queries/logsQuery";
import { Time } from "@/design-system/Time";
import { Badge } from "@/design-system/Badge";
import { Table } from "@/design-system/Table";

interface LogRecordsTableProps {
  items: {
    /** Ignored when `variant` is `"flat"`. Groups by this value and used as the group's display label. */
    groupKey: string;
    severityNumber?: number;
    severityText?: string;
    timeUnixNano: string;
    body: AnyValue | undefined;
    attributes: { key: string; value: AnyValue | undefined }[];
  }[];
  /** `"grouped"` partitions rows by `groupKey` under collapsible headers. `"flat"` renders a single row list. */
  variant: "flat" | "grouped";
}

type Item = LogRecordsTableProps["items"][number];

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
    return `{${value.kvlistValue.values?.map((kv) => `${kv.key}: ${renderAnyValue(kv.value)}`).join(", ") ?? ""}}`;
  }
  return "";
}

type Row =
  | { type: "header"; rowKey: string; group: { key: string; items: Item[] }; collapsed: boolean }
  | { type: "log"; rowKey: string; item: Item }
  | { type: "detail"; rowKey: string; item: Item; expanded: boolean };

function severityRank(item: Item): number {
  if (typeof item.severityNumber === "number") return item.severityNumber;
  const text = item.severityText?.toUpperCase() ?? "";
  if (text.startsWith("ERROR") || text.startsWith("FATAL")) return 17;
  if (text.startsWith("WARN")) return 13;
  if (text.startsWith("DEBUG")) return 5;
  return 9;
}

function severityLabel(item: Item): string {
  return item.severityText ?? String(item.severityNumber ?? "");
}

function severityTone(item: Item): "error" | "warn" | "neutral" | "info" {
  const rank = severityRank(item);
  if (rank >= 17) return "error";
  if (rank >= 13) return "warn";
  if (rank < 9) return "neutral";
  return "info";
}

const LogRow = memo(function LogRow(props: {
  item: Item;
  grouped: boolean;
  rowKey: string;
  dataIndex: number;
  measureRef: (node: Element | null) => void;
  onToggle: (rowKey: string) => void;
}) {
  const { item, grouped, rowKey, dataIndex, measureRef, onToggle } = props;
  const tone = severityTone(item);
  const body = renderAnyValue(item.body);
  return (
    <Table.Row
      ref={measureRef}
      data-index={dataIndex}
      onClick={() => onToggle(rowKey)}
      className="cursor-pointer hover:bg-panel-header"
    >
      {!grouped && <Table.Cell className="w-px whitespace-nowrap font-medium text-panel-muted">{item.groupKey}</Table.Cell>}
      <Table.Cell className="w-px whitespace-nowrap">
        <Badge tone={tone}>{severityLabel(item)}</Badge>
      </Table.Cell>
      <Table.Cell className="w-px whitespace-nowrap font-mono text-xs text-panel-muted">
        <Time unixNano={item.timeUnixNano} />
      </Table.Cell>
      <Table.Cell>
        <p title={body} className="line-clamp-2 wrap-break-word">
          {body}
        </p>
      </Table.Cell>
    </Table.Row>
  );
});

const DetailRow = memo(function DetailRow(props: {
  item: Item;
  columnCount: number;
  dataIndex: number;
  expanded: boolean;
  measureRef: (node: Element | null) => void;
}) {
  const { item, columnCount, dataIndex, expanded, measureRef } = props;
  // Kept mounted (with content toggled inside) rather than returning null when collapsed: the
  // virtualizer's ResizeObserver only re-measures a row while its element stays connected, so
  // unmounting the row instead of shrinking its content leaves the last-measured (expanded)
  // height stuck in the size cache, showing as blank space below.
  return (
    <Table.Row ref={measureRef} data-index={dataIndex}>
      <Table.Cell colSpan={columnCount} className={expanded ? "border-panel-border bg-panel-header" : "border-none p-0!"}>
        {expanded && (
          <>
            <div className="rounded-lg border border-panel-border bg-panel p-3">
              <h4 className="text-xs font-medium text-panel-muted">Body</h4>
              <hr className="border-panel-border-subtle my-1" />
              <p className="mt-2 whitespace-pre-wrap wrap-break-word text-xs text-panel-muted">{renderAnyValue(item.body)}</p>
            </div>
            <div className="mt-2 rounded-lg border border-panel-border bg-panel p-3">
              <h4 className="text-xs font-medium text-panel-muted">Attributes</h4>
              <hr className="border-panel-border-subtle my-1" />
              {item.attributes.length === 0 ? (
                <p className="mt-2 text-xs italic text-panel-subtle">No attributes</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {item.attributes.map((attribute, index) => (
                    <div key={attribute.key ?? index} className="font-mono text-xs">
                      <div className="text-panel-subtle">{attribute.key}</div>
                      <div className="whitespace-pre-wrap break-all text-panel-muted">{renderAnyValue(attribute.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Table.Cell>
    </Table.Row>
  );
});

export function LogRecordsTable(props: LogRecordsTableProps) {
  const { items, variant } = props;
  const grouped = variant === "grouped";

  const groups = useMemo(() => {
    if (!grouped) return undefined;
    const byKey = new Map<string, { key: string; items: Item[] }>();
    for (const item of items) {
      const existing = byKey.get(item.groupKey);
      if (existing) {
        existing.items.push(item);
      } else {
        byKey.set(item.groupKey, { key: item.groupKey, items: [item] });
      }
    }
    return [...byKey.values()].sort((a, b) => b.items.length - a.items.length);
  }, [grouped, items]);

  // Groups start collapsed so the initial row list stays bounded regardless of dataset size.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(groups?.map((group) => group.key)));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((rowKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const rows: Row[] = useMemo(() => {
    if (!groups) {
      const result: Row[] = [];
      for (const [index, item] of items.entries()) {
        const rowKey = `log:${index}`;
        result.push({ type: "log", rowKey, item });
        result.push({ type: "detail", rowKey: `detail:${index}`, item, expanded: expanded.has(rowKey) });
      }
      return result;
    }
    const result: Row[] = [];
    for (const group of groups) {
      const collapsed = collapsedGroups.has(group.key);
      result.push({ type: "header", rowKey: `header:${group.key}`, group, collapsed });
      if (!collapsed) {
        for (const [index, item] of group.items.entries()) {
          const rowKey = `log:${group.key}:${index}`;
          result.push({ type: "log", rowKey, item });
          result.push({ type: "detail", rowKey: `detail:${group.key}:${index}`, item, expanded: expanded.has(rowKey) });
        }
      }
    }
    return result;
  }, [groups, items, collapsedGroups, expanded]);

  const columnCount = grouped ? 3 : 4;

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index].rowKey,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return 57;
      if (row.type === "header") return 37;
      if (row.type === "detail") return row.expanded ? 160 : 0;
      return 57;
    },
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={scrollRef} className="h-150 overflow-auto rounded-lg border border-panel-border bg-panel">
      <Table>
        <Table.Header className="sticky top-0 z-10 bg-panel-header">
          <Table.Row>
            {!grouped && <Table.Head className="w-px min-w-50 whitespace-nowrap">Resource</Table.Head>}
            <Table.Head className="w-px min-w-30 whitespace-nowrap">Severity</Table.Head>
            <Table.Head className="w-px min-w-44 whitespace-nowrap">Time</Table.Head>
            <Table.Head>Body</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {paddingTop > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];

            if (row.type === "header") {
              return (
                <Table.Row key={row.rowKey} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                  <Table.Cell colSpan={columnCount} className="border-none p-0!">
                    <button
                      onClick={() => toggleGroup(row.group.key)}
                      className="flex w-full items-center gap-2 border-b border-panel-border bg-panel-header px-3 py-2 text-left text-sm font-medium hover:bg-panel-border-subtle"
                    >
                      <span className="w-3 shrink-0">{row.collapsed ? "▸" : "▾"}</span>
                      <span>{row.group.key}</span>
                      <span className="text-panel-subtle">({row.group.items.length})</span>
                    </button>
                  </Table.Cell>
                </Table.Row>
              );
            }

            if (row.type === "detail") {
              return (
                <DetailRow
                  key={row.rowKey}
                  item={row.item}
                  columnCount={columnCount}
                  dataIndex={virtualRow.index}
                  expanded={row.expanded}
                  measureRef={rowVirtualizer.measureElement}
                />
              );
            }

            return (
              <LogRow
                key={row.rowKey}
                item={row.item}
                grouped={grouped}
                rowKey={row.rowKey}
                dataIndex={virtualRow.index}
                measureRef={rowVirtualizer.measureElement}
                onToggle={toggleExpanded}
              />
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          )}
        </Table.Body>
      </Table>
    </div>
  );
}
