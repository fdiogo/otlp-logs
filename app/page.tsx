"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Group, List } from "lucide-react";
import { logsQuery, type AnyValue } from "@/queries/logsQuery";
import { TimeHistogram } from "@/design-system/TimeHistogram";
import { LogRecordsTable } from "@/components/LogRecordsTable";
import { ToggleGroup } from "@/design-system/ToggleGroup";
import { Skeleton } from "@/design-system/Skeleton";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGrouped = searchParams.has("groupBy");

  const { data, isPending } = useQuery(logsQuery);

  const logRecordsWithLabel = useMemo(
    () =>
      data?.resourceLogs?.flatMap((resourceLog) => {
        const namespace = resourceLog.resource?.attributes?.find((attribute) => attribute.key === "service.namespace")?.value?.stringValue;

        // OpenTelemetry's own convention for a resource with no service.name attribute set.
        const name =
          resourceLog.resource?.attributes?.find((attribute) => attribute.key === "service.name")?.value?.stringValue ?? "unknown_service";

        const resourceLabel = namespace ? `${namespace}/${name}` : name;
        return (resourceLog.scopeLogs ?? []).flatMap((scopeLog) =>
          (scopeLog.logRecords ?? []).map((logRecord) => ({
            ...logRecord,
            resourceLabel,
          })),
        );
      }) ?? [],
    [data?.resourceLogs],
  );

  const sortedLogRecordsWithLabel = useMemo(
    () => 
      logRecordsWithLabel.sort((a, b) => {
        if (a.timeUnixNano == null) return b.timeUnixNano == null ? 0 : 1;
        if (b.timeUnixNano == null) return -1;
        const aNano = BigInt(a.timeUnixNano);
        const bNano = BigInt(b.timeUnixNano);
        return aNano < bNano ? 1 : aNano > bNano ? -1 : 0;
      }),
    [logRecordsWithLabel],
  );

  const histogramItems = useMemo(
    () =>
      sortedLogRecordsWithLabel
        .filter((record) => record.timeUnixNano != null)
        .map((record) => ({ timeUnixNano: record.timeUnixNano!, groupKey: record.resourceLabel })),
    [sortedLogRecordsWithLabel],
  );

  const logItems = useMemo(() => {
    function toNativeValue(value: AnyValue | undefined): unknown {
      if (value === undefined) return undefined;
      if (value.stringValue !== undefined) return value.stringValue;
      if (value.boolValue !== undefined) return value.boolValue;
      if (value.intValue !== undefined) return value.intValue;
      if (value.doubleValue !== undefined) return value.doubleValue;
      if (value.bytesValue !== undefined) return value.bytesValue;
      if (value.arrayValue !== undefined) return value.arrayValue.values?.map(toNativeValue) ?? [];
      if (value.kvlistValue !== undefined) {
        return Object.fromEntries(value.kvlistValue.values?.map((kv) => [kv.key, toNativeValue(kv.value)]) ?? []);
      }
      return undefined;
    }

    return sortedLogRecordsWithLabel.map((record) => ({
      groupKey: record.resourceLabel,
      severityNumber: record.severityNumber,
      severityText: record.severityText,
      timeUnixNano: record.timeUnixNano ?? "0",
      body: toNativeValue(record.body),
      attributes: (record.attributes ?? []).map((attribute) => ({
        key: attribute.key ?? "",
        value: toNativeValue(attribute.value),
      })),
    }));
  }, [sortedLogRecordsWithLabel]);

  return (
    <div className="h-screen p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Logs</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-panel-muted">Group by</span>
          <ToggleGroup
            value={isGrouped ? "grouped" : "flat"}
            onChange={(value: "flat" | "grouped") => {
              const nextParams = new URLSearchParams(searchParams.toString());
              if (value === "grouped") {
                nextParams.set("groupBy", "service");
              } else {
                nextParams.delete("groupBy");
              }
              router.push(`?${nextParams.toString()}`);
            }}
            options={[
              { value: "flat", label: "None", icon: List },
              { value: "grouped", label: "Service", icon: Group },
            ]}
          />
        </div>
      </div>

      {isPending ? (
        <div className="mb-4 flex h-40 items-end gap-1.5 rounded-lg border border-panel-border bg-panel p-3">
          {[30, 45, 35, 60, 50, 70, 55, 80, 65, 90, 75, 60, 85, 50, 40, 55, 35, 45, 30, 40].map((heightPercent, index) => (
            <Skeleton key={index} className="flex-1" style={{ height: `${heightPercent}%` }} />
          ))}
        </div>
      ) : (
        <TimeHistogram items={histogramItems} variant={isGrouped ? "grouped" : "flat"} className="mb-4" />
      )}

      {isPending ? (
        <div className="h-150 overflow-hidden rounded-lg border border-panel-border bg-panel">
          <div className="flex items-center gap-3 border-b border-panel-border bg-panel-header px-3 py-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
          </div>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-panel-border-subtle px-3 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : (
        <LogRecordsTable items={logItems} variant={isGrouped ? "grouped" : "flat"} />
      )}
    </div>
  );
}
