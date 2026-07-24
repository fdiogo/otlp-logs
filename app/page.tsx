"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Group, List } from "lucide-react";
import { logsQuery } from "@/queries/logsQuery";
import { LogHistogram } from "@/components/LogHistogram";
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

  const sortedLogRecords = useMemo(
    () =>
      data?.resourceLogs
        ?.flatMap((resourceLog) => {
          const namespace = resourceLog.resource?.attributes?.find((attribute) => attribute.key === "service.namespace")?.value
            ?.stringValue;

          // OpenTelemetry's own convention for a resource with no service.name attribute set.
          const name =
            resourceLog.resource?.attributes?.find((attribute) => attribute.key === "service.name")?.value?.stringValue ??
            "unknown_service";

          const resourceLabel = namespace ? `${namespace}/${name}` : name;
          return (resourceLog.scopeLogs ?? []).flatMap((scopeLog) =>
            (scopeLog.logRecords ?? []).map((logRecord) => ({
              ...logRecord,
              resourceLabel,
            })),
          );
        })
        .sort((a, b) => {
          if (a.timeUnixNano == null) return b.timeUnixNano == null ? 0 : 1;
          if (b.timeUnixNano == null) return -1;
          const aNano = BigInt(a.timeUnixNano);
          const bNano = BigInt(b.timeUnixNano);
          return aNano < bNano ? 1 : aNano > bNano ? -1 : 0;
        }),
    [data],
  );

  const logRecordsByService = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; logRecords: NonNullable<typeof sortedLogRecords> }>();

    // sortedLogRecords is already sorted by time desc, so appending here needs no re-sort per group.
    for (const logRecord of sortedLogRecords ?? []) {
      const existing = groups.get(logRecord.resourceLabel);
      if (existing) {
        existing.logRecords.push(logRecord);
      } else {
        groups.set(logRecord.resourceLabel, { key: logRecord.resourceLabel, label: logRecord.resourceLabel, logRecords: [logRecord] });
      }
    }

    return [...groups.values()].sort((a, b) => b.logRecords.length - a.logRecords.length);
  }, [sortedLogRecords]);

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
      ) : isGrouped ? (
        <LogHistogram variant="stacked" serviceGroups={logRecordsByService} className="mb-4" />
      ) : (
        <LogHistogram logRecords={sortedLogRecords ?? []} className="mb-4" />
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
      ) : isGrouped ? (
        <LogRecordsTable groups={logRecordsByService} />
      ) : (
        <LogRecordsTable logRecords={sortedLogRecords ?? []} />
      )}
    </div>
  );
}
