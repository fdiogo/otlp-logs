import type { LogRecord, ResourceLogs } from "@/app/generated/opentelemetry/proto/logs/v1/logs";
import { getResourceLabel } from "./resourceLabel";

export interface ServiceGroup {
  /** Stable identity: service.namespace + service.name, namespace omitted when unset. */
  key: string;
  label: string;
  logRecords: LogRecord[];
}

/**
 * Groups log records by Service Group (service.namespace + service.name).
 * Merges resourceLogs entries that resolve to the same key, since the same
 * service can appear as multiple separate resources. Sorted descending by count.
 */
export function groupLogRecordsByService(resourceLogs: ResourceLogs[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();

  for (const resourceLog of resourceLogs) {
    const logRecords = (resourceLog.scopeLogs ?? []).flatMap((scopeLog) => scopeLog.logRecords ?? []);
    if (logRecords.length === 0) continue;

    const key = getResourceLabel(resourceLog.resource);
    const existing = groups.get(key);
    if (existing) {
      existing.logRecords.push(...logRecords);
    } else {
      groups.set(key, { key, label: key, logRecords });
    }
  }

  return [...groups.values()].sort((a, b) => b.logRecords.length - a.logRecords.length);
}
