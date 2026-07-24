import type { Resource } from "@/app/generated/opentelemetry/proto/resource/v1/resource";
import type { LogRecord, ResourceLogs } from "@/app/generated/opentelemetry/proto/logs/v1/logs";

/** OpenTelemetry's own convention for a resource with no service.name attribute set. */
const UNKNOWN_SERVICE_NAME = "unknown_service";

export interface ServiceGroup {
  /** Stable identity: service.namespace + service.name, namespace omitted when unset. */
  key: string;
  label: string;
  logRecords: LogRecord[];
}

function getStringAttribute(resource: Resource | undefined, key: string): string | undefined {
  return resource?.attributes?.find((attribute) => attribute.key === key)?.value?.stringValue;
}

function getServiceGroupKey(resource: Resource | undefined): string {
  const namespace = getStringAttribute(resource, "service.namespace");
  const name = getStringAttribute(resource, "service.name") ?? UNKNOWN_SERVICE_NAME;
  return namespace ? `${namespace}/${name}` : name;
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

    const key = getServiceGroupKey(resourceLog.resource);
    const existing = groups.get(key);
    if (existing) {
      existing.logRecords.push(...logRecords);
    } else {
      groups.set(key, { key, label: key, logRecords });
    }
  }

  return [...groups.values()].sort((a, b) => b.logRecords.length - a.logRecords.length);
}
