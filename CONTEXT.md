# OTLP Log Viewer

A viewer for OTLP log records that lets engineers scan logs flat or grouped by the service that emitted them.

## Language

**Flat View**:
The default display mode — log records rendered as a single ungrouped table, and the histogram as one aggregate time series.
_Avoid_: ungrouped view, default view

**Grouped View**:
The display mode, entered via the `groupBy=service` URL search param, where log records are partitioned into Service Groups in the table, and the histogram is split into per-Service-Group stacked segments. The table stays a single virtualized row list — Service Groups are rendered as header rows interleaved with log rows in that same list, not as separate tables per group. Groups are collapsed by default, so the initial row list stays bounded regardless of how many services are in the dataset; the per-row Resource column is hidden in this mode since the group header already identifies the service.
_Avoid_: group mode, service view

**Service Group**:
The unit of grouping in Grouped View: all log records whose resource shares the same `service.namespace` + `service.name` pair. Namespace is omitted from the identity when a resource doesn't set it, since OTel treats namespace as an optional disambiguator, not a required dimension.
_Avoid_: service (ambiguous with the raw `service.name` attribute alone)

**unknown_service**:
The Service Group name used when a resource has no `service.name` attribute. Reuses OpenTelemetry's own SDK convention for an unset service name, rather than an app-invented placeholder.

**Top-8 + Other cap**:
A histogram-only rule: only the 8 Service Groups with the highest total log volume across the whole dataset get their own stacked segment; every other Service Group's counts are folded into a single synthetic "Other" segment. Ranking is computed once globally, not per bucket, so a segment's color and stack position stay stable across every bucket. This cap does not apply to the table's Grouped View, which always lists every Service Group uncapped.
