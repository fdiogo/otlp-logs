"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Group, List } from "lucide-react";
import { logsQuery } from "@/queries/logsQuery";
import { bucketLogRecords } from "@/queries/bucketLogRecords";
import { bucketLogRecordsByService } from "@/queries/bucketLogRecordsByService";
import { computeBucketDuration, BUCKET_DURATION_LADDER_MS } from "@/queries/computeBucketDuration";
import { groupLogRecordsByService } from "@/queries/serviceGroup";
import { getResourceLabel } from "@/queries/resourceLabel";
import { LogHistogram } from "@/components/LogHistogram";
import { LogRecordsTable } from "@/components/LogRecordsTable";
import { ToggleGroup } from "@/design-system/ToggleGroup";

const VIEW_OPTIONS = [
  { value: "flat" as const, label: "None", icon: List },
  { value: "grouped" as const, label: "Service", icon: Group },
];

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGrouped = searchParams.has("groupBy");

  const handleViewChange = useCallback(
    (value: "flat" | "grouped") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (value === "grouped") {
        nextParams.set("groupBy", "service");
      } else {
        nextParams.delete("groupBy");
      }
      router.push(`${pathname}?${nextParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const { data: resourceLogs = [] } = useQuery({
    ...logsQuery,
    select: (data) => data?.resourceLogs ?? [],
  });

  const logRecords = useMemo(
    () =>
      resourceLogs.flatMap((resourceLog) => {
        const resourceLabel = getResourceLabel(resourceLog.resource);
        return (resourceLog.scopeLogs ?? []).flatMap((scopeLog) =>
          (scopeLog.logRecords ?? []).map((logRecord) => ({ ...logRecord, resourceLabel })),
        );
      }),
    [resourceLogs],
  );
  const serviceGroups = useMemo(() => groupLogRecordsByService(resourceLogs), [resourceLogs]);

  const bucketDurationMs = useMemo(() => {
    let minTimeMs = Infinity;
    let maxTimeMs = -Infinity;
    for (const record of logRecords) {
      if (record.timeUnixNano == null) continue;
      const timeMs = Number(BigInt(record.timeUnixNano) / BigInt(1_000_000));
      if (timeMs < minTimeMs) minTimeMs = timeMs;
      if (timeMs > maxTimeMs) maxTimeMs = timeMs;
    }
    if (minTimeMs === Infinity) return BUCKET_DURATION_LADDER_MS[0];
    return computeBucketDuration(minTimeMs, maxTimeMs);
  }, [logRecords]);

  const flatBuckets = useMemo(
    () => bucketLogRecords(logRecords, bucketDurationMs),
    [logRecords, bucketDurationMs],
  );
  const groupedBuckets = useMemo(
    () => bucketLogRecordsByService(serviceGroups, bucketDurationMs),
    [serviceGroups, bucketDurationMs],
  );

  return (
    <div className="h-screen p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Logs</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-panel-muted">Group by</span>
          <ToggleGroup
            value={isGrouped ? "grouped" : "flat"}
            onChange={handleViewChange}
            options={VIEW_OPTIONS}
          />
        </div>
      </div>

      {isGrouped ? (
        <LogHistogram
          variant="stacked"
          {...groupedBuckets}
          bucketDurationMs={bucketDurationMs}
          className="mb-4"
        />
      ) : (
        <LogHistogram buckets={flatBuckets} bucketDurationMs={bucketDurationMs} className="mb-4" />
      )}

      {isGrouped ? <LogRecordsTable groups={serviceGroups} /> : <LogRecordsTable logRecords={logRecords} />}
    </div>
  );
}
