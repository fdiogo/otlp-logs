"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { logsQuery } from "@/queries/logsQuery";
import { bucketLogRecords } from "@/queries/bucketLogRecords";
import { bucketLogRecordsByService } from "@/queries/bucketLogRecordsByService";
import { groupLogRecordsByService } from "@/queries/serviceGroup";
import { getResourceLabel } from "@/queries/resourceLabel";
import { LogHistogram } from "@/components/LogHistogram";
import { LogRecordsTable } from "@/components/LogRecordsTable";
import { ServiceGroupSection } from "@/components/ServiceGroupSection";

const HISTOGRAM_BUCKET_DURATION_MS = 60_000;

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
          {...bucketLogRecordsByService(serviceGroups, HISTOGRAM_BUCKET_DURATION_MS)}
          bucketDurationMs={HISTOGRAM_BUCKET_DURATION_MS}
          className="mb-4"
        />
      ) : (
        <LogHistogram
          buckets={bucketLogRecords(logRecords, HISTOGRAM_BUCKET_DURATION_MS)}
          bucketDurationMs={HISTOGRAM_BUCKET_DURATION_MS}
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
