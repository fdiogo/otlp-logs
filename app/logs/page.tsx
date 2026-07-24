"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logsQuery } from "@/queries/logsQuery";

export default function LogsPage() {
  const { data: logRecords = [] } = useQuery({
    ...logsQuery,
    select: (data) =>
      (data?.resourceLogs ?? []).flatMap((resourceLog) =>
        (resourceLog.scopeLogs ?? []).flatMap(
          (scopeLog) => scopeLog.logRecords ?? [],
        ),
      ),
  });

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

  return (
    <div className="h-screen p-4">
      <h1 className="mb-3 text-lg font-semibold">Logs</h1>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Severity</th>
            <th className="border-b p-2">Time</th>
            <th className="border-b p-2">Body</th>
          </tr>
        </thead>
        <tbody>
          {logRecords.map((log, index) => (
            <Fragment key={index}>
              <tr
                onClick={() => toggleExpanded(index)}
                className="cursor-pointer hover:bg-black/5"
              >
                <td className="border-b p-2">
                  {log.severityText ?? log.severityNumber}
                </td>
                <td className="border-b p-2">{log.timeUnixNano}</td>
                <td className="border-b p-2">{JSON.stringify(log.body)}</td>
              </tr>
              {expanded.has(index) && (
                <tr>
                  <td colSpan={3} className="border-b p-2">
                    <pre>{JSON.stringify(log.attributes, null, 2)}</pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
