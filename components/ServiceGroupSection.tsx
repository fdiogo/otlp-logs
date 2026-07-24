"use client";

import { useState } from "react";
import type { ServiceGroup } from "@/queries/serviceGroup";
import { LogRecordsTable } from "@/components/LogRecordsTable";

export function ServiceGroupSection({ group }: { group: ServiceGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="mb-4">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 border-b p-2 text-left text-sm font-medium hover:bg-black/5"
      >
        <span className="w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
        <span>{group.label}</span>
        <span className="text-black/50">({group.logRecords.length})</span>
      </button>
      {expanded && <LogRecordsTable logRecords={group.logRecords} />}
    </section>
  );
}
