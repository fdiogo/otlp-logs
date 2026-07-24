import type { Resource } from "@/app/generated/opentelemetry/proto/resource/v1/resource";

/** OpenTelemetry's own convention for a resource with no service.name attribute set. */
const UNKNOWN_SERVICE_NAME = "unknown_service";

function getStringAttribute(resource: Resource | undefined, key: string): string | undefined {
  return resource?.attributes?.find((attribute) => attribute.key === key)?.value?.stringValue;
}

/** Identifies a resource by service.namespace + service.name, namespace omitted when unset. */
export function getResourceLabel(resource: Resource | undefined): string {
  const namespace = getStringAttribute(resource, "service.namespace");
  const name = getStringAttribute(resource, "service.name") ?? UNKNOWN_SERVICE_NAME;
  return namespace ? `${namespace}/${name}` : name;
}
