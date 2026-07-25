"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cnfast";
import { Time } from "@/design-system/Time";
import { Badge } from "@/design-system/Badge";
import { Table } from "@/design-system/Table";

interface LogRecordsTableProps {
  items: {
    /** Ignored when `groupBy` is unset. Groups by this value and used as the group's display label. */
    resourceKey: string;
    severityNumber?: number;
    severityText?: string;
    timeUnixNano: string;
    body: unknown;
    attributes: { key: string; value: unknown }[];
  }[];
  /** `"resource"` partitions rows by `resourceKey` under collapsible headers. Unset renders a single row list. */
  groupBy?: "resource" | null;
  className?: string;
}

type Item = LogRecordsTableProps["items"][number];

type Row =
  | { type: "header"; rowKey: string; group: { key: string; items: Item[] }; collapsed: boolean }
  | { type: "log"; rowKey: string; item: Item }
  | { type: "detail"; rowKey: string; item: Item; expanded: boolean };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function renderValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value instanceof Uint8Array) return `base64:${bytesToBase64(value)}`;
  if (Array.isArray(value)) return `[${value.map(renderValue).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, entry]) => `${key}: ${renderValue(entry)}`)
      .join(", ")}}`;
  }
  return "";
}

/**
 * Recursive, syntax-highlighted rendering of a JSON-like value; used for the contents of
 * arrays/objects. `compact` renders everything on one line (no indentation/newlines), for use
 * in constrained spaces like a table cell.
 */
function JsonNode(props: { value: unknown; indent: number; compact?: boolean }) {
  const { value, indent, compact } = props;
  if (value === undefined || value === null) {
    return <span className="italic text-panel-subtle">null</span>;
  }
  if (typeof value === "string") {
    return <span className="text-emerald-700">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-blue-700">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-amber-700">{String(value)}</span>;
  }
  if (value instanceof Uint8Array) {
    return <span className="text-purple-700">{`base64:${JSON.stringify(bytesToBase64(value))}`}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>;
    if (compact) {
      return (
        <>
          {"["}
          {value.map((entry, index) => (
            <span key={index}>
              <JsonNode value={entry} indent={0} compact />
              {index < value.length - 1 ? ", " : ""}
            </span>
          ))}
          {"]"}
        </>
      );
    }
    const pad = "  ".repeat(indent);
    const padChild = "  ".repeat(indent + 1);
    return (
      <>
        {"[\n"}
        {value.map((entry, index) => (
          <span key={index}>
            {padChild}
            <JsonNode value={entry} indent={indent + 1} />
            {index < value.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {pad}
        {"]"}
      </>
    );
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return <span>{"{}"}</span>;
  if (compact) {
    return (
      <>
        {"{"}
        {entries.map(([key, entry], index) => (
          <span key={key}>
            <span className="text-panel-subtle">{JSON.stringify(key)}</span>
            {": "}
            <JsonNode value={entry} indent={0} compact />
            {index < entries.length - 1 ? ", " : ""}
          </span>
        ))}
        {"}"}
      </>
    );
  }
  const pad = "  ".repeat(indent);
  const padChild = "  ".repeat(indent + 1);
  return (
    <>
      {"{\n"}
      {entries.map(([key, entry], index) => (
        <span key={key}>
          {padChild}
          <span className="text-panel-subtle">{JSON.stringify(key)}</span>
          {": "}
          <JsonNode value={entry} indent={indent + 1} />
          {index < entries.length - 1 ? "," : ""}
          {"\n"}
        </span>
      ))}
      {pad}
      {"}"}
    </>
  );
}

type ValueKind = "null" | "string" | "number" | "boolean" | "bytes" | "array" | "object";

const VALUE_KIND_LABEL: Record<ValueKind, string> = {
  null: "null",
  string: "string",
  number: "number",
  boolean: "boolean",
  bytes: "bytes",
  array: "array",
  object: "object",
};

function valueKind(value: unknown): ValueKind {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Uint8Array) return "bytes";
  if (Array.isArray(value)) return "array";
  return "object";
}

/** Type-aware rendering of a body/attribute value: JSON with syntax highlighting for arrays/objects, code font for scalars. */
function ValueDisplay(props: { value: unknown }) {
  const { value } = props;
  switch (valueKind(value)) {
    case "null":
      return <span className="text-xs italic text-panel-subtle">null</span>;
    case "string":
      return <p className="whitespace-pre-wrap wrap-break-word text-xs text-panel-muted">{value as string}</p>;
    case "number":
      return <p className="font-mono text-xs text-blue-700">{value as number}</p>;
    case "boolean":
      return <p className="font-mono text-xs text-amber-700">{String(value)}</p>;
    case "bytes":
      return (
        <p className="whitespace-pre-wrap break-all font-mono text-xs text-purple-700">
          <span className="text-panel-subtle">base64:</span>
          {bytesToBase64(value as Uint8Array)}
        </p>
      );
    default:
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-panel-muted">
          <JsonNode value={value} indent={0} />
        </pre>
      );
  }
}

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

const DETAIL_TONE_BORDER: Record<ReturnType<typeof severityTone>, string> = {
  error: "border-l-red-400",
  warn: "border-l-amber-400",
  neutral: "border-l-panel-border",
  info: "border-l-blue-400",
};

function ExpandChevron(props: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn(
        "size-3 shrink-0 text-panel-subtle transition-transform duration-150",
        props.expanded && "rotate-90",
      )}
    >
      <path d="M5 3l6 5-6 5V3z" />
    </svg>
  );
}

const LogRow = memo(function LogRow(props: {
  item: Item;
  grouped: boolean;
  rowKey: string;
  dataIndex: number;
  expanded: boolean;
  measureRef: (node: Element | null) => void;
  onToggle: (rowKey: string) => void;
}) {
  const { item, grouped, rowKey, dataIndex, expanded, measureRef, onToggle } = props;
  const tone = severityTone(item);
  const body = renderValue(item.body);
  const isJsonBody = typeof item.body === "object" && item.body !== null && !(item.body instanceof Uint8Array);
  return (
    <Table.Row
      ref={measureRef}
      data-index={dataIndex}
      onClick={() => onToggle(rowKey)}
      className={cn("cursor-pointer hover:bg-panel-header", expanded && "bg-panel-header")}
    >
      <Table.Cell className={cn("w-px whitespace-nowrap border-l-2", DETAIL_TONE_BORDER[tone])}>
        <span className="flex items-center gap-1.5">
          <ExpandChevron expanded={expanded} />
          <Badge tone={tone}>{severityLabel(item)}</Badge>
        </span>
      </Table.Cell>
      <Table.Cell className="w-px whitespace-nowrap font-mono text-xs text-panel-muted">
        <Time unixNano={item.timeUnixNano} />
      </Table.Cell>
      {!grouped && (
        <Table.Cell className="w-px whitespace-nowrap font-medium text-panel-muted">{item.resourceKey}</Table.Cell>
      )}
      <Table.Cell>
        <p title={body} className={`line-clamp-2 wrap-break-word ${isJsonBody ? "font-mono text-xs" : ""}`}>
          {isJsonBody ? <JsonNode value={item.body} indent={0} compact /> : body}
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
  const tone = severityTone(item);
  // Kept mounted (with content toggled inside) rather than returning null when collapsed: the
  // virtualizer's ResizeObserver only re-measures a row while its element stays connected, so
  // unmounting the row instead of shrinking its content leaves the last-measured (expanded)
  // height stuck in the size cache, showing as blank space below.
  return (
    <Table.Row ref={measureRef} data-index={dataIndex}>
      <Table.Cell
        colSpan={columnCount}
        className={
          expanded
            ? cn("border-panel-border-subtle border-l-2 bg-panel-header/40 p-3", DETAIL_TONE_BORDER[tone])
            : "border-none p-0!"
        }
      >
        {expanded && (
          <>
            <div className="rounded-lg border border-panel-border bg-panel p-3">
              <h4 className="text-xs font-medium text-panel-muted">Body</h4>
              <hr className="border-panel-border-subtle my-1" />
              <div className="mt-2">
                <ValueDisplay value={item.body} />
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-panel-border bg-panel p-3">
              <h4 className="text-xs font-medium text-panel-muted">Attributes</h4>
              <hr className="border-panel-border-subtle my-1" />
              {item.attributes.length === 0 ? (
                <p className="mt-2 text-xs italic text-panel-subtle">No attributes</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {item.attributes.map((attribute, index) => (
                    <div key={attribute.key ?? index}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-panel-subtle">{attribute.key}</span>
                        <Badge tone="neutral" className="px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide">
                          {VALUE_KIND_LABEL[valueKind(attribute.value)]}
                        </Badge>
                      </div>
                      <ValueDisplay value={attribute.value} />
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
  const { items, groupBy, className } = props;
  const grouped = groupBy === "resource";

  const groups = useMemo(() => {
    if (!grouped) return undefined;
    const byKey = new Map<string, { key: string; items: Item[] }>();
    for (const item of items) {
      const existing = byKey.get(item.resourceKey);
      if (existing) {
        existing.items.push(item);
      } else {
        byKey.set(item.resourceKey, { key: item.resourceKey, items: [item] });
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
    <div ref={scrollRef} className={cn("overflow-auto rounded-lg border border-panel-border bg-panel", className)}>
      <Table>
        <Table.Header className="sticky top-0 z-10 bg-panel-header">
          <Table.Row>
            <Table.Head className="w-px min-w-30 whitespace-nowrap">Severity</Table.Head>
            <Table.Head className="w-px min-w-44 whitespace-nowrap">Time</Table.Head>
            {!grouped && <Table.Head className="w-px min-w-50 whitespace-nowrap">Resource</Table.Head>}
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
                expanded={expanded.has(row.rowKey)}
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
