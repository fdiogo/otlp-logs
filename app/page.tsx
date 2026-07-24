"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { logsQuery } from "@/queries/logsQuery";
import { bucketLogRecords } from "@/queries/bucketLogRecords";
import { bucketLogRecordsByService } from "@/queries/bucketLogRecordsByService";
import { computeBucketDuration, BUCKET_DURATION_LADDER_MS } from "@/queries/computeBucketDuration";
import { groupLogRecordsByService } from "@/queries/serviceGroup";
import { getResourceLabel } from "@/queries/resourceLabel";
import { LogHistogram } from "@/components/LogHistogram";
import { LogRecordsTable } from "@/components/LogRecordsTable";
import { ServiceGroupSection } from "@/components/ServiceGroupSection";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isGrouped = searchParams.has("groupBy");

  const toggleParams = new URLSearchParams(searchParams.toString());
  if (isGrouped) {
    toggleParams.delete("groupBy");
  } else {
    toggleParams.set("groupBy", "service");
  }
  const toggleHref = `${pathname}?${toggleParams.toString()}`;

  const { data: resourceLogs = [] } = useQuery({
    ...logsQuery,
    select: (data) => data?.resourceLogs ?? [],
  });

  const logRecords = resourceLogs.flatMap((resourceLog) => {
    const resourceLabel = getResourceLabel(resourceLog.resource);
    return (resourceLog.scopeLogs ?? []).flatMap((scopeLog) =>
      (scopeLog.logRecords ?? []).map((logRecord) => ({ ...logRecord, resourceLabel })),
    );
  });
  const serviceGroups = groupLogRecordsByService(resourceLogs);

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

  return (
    <div className="h-screen p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Logs</h1>
        <Link href={toggleHref} className="text-sm underline">
          {isGrouped ? "Show flat list" : "Group by service"}
        </Link>
      </div>

      {isGrouped ? (
        <LogHistogram
          variant="stacked"
          {...bucketLogRecordsByService(serviceGroups, bucketDurationMs)}
          bucketDurationMs={bucketDurationMs}
          className="mb-4"
        />
      ) : (
        <LogHistogram
          buckets={bucketLogRecords(logRecords, bucketDurationMs)}
          bucketDurationMs={bucketDurationMs}
          className="mb-4"
        />
      )}

      {isGrouped ? (
        <div>
          {serviceGroups.map((group) => (
            <ServiceGroupSection key={group.key} group={group} />
          ))}
        </div>
      ) : (
        <LogRecordsTable logRecords={logRecords} />
      )}
    </div>
  );
}
