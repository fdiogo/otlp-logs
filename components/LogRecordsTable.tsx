"use client";

import { Fragment, useState } from "react";
import type { LogRecord } from "@/app/generated/opentelemetry/proto/logs/v1/logs";

export function LogRecordsTable({ logRecords }: { logRecords: LogRecord[] }) {
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
              <td className="border-b p-2">{log.severityText ?? log.severityNumber}</td>
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
  );
}
