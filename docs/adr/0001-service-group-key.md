# Service Group key includes namespace, not just service name

We group log records by `service.namespace` + `service.name`, not `service.name` alone. Grouping by name alone would silently merge two different teams' same-named services into one group; grouping by the full `namespace + name + version` triple would fragment a single service's Grouped-View group across ordinary rolling deploys. Namespace is included as a disambiguator, version is not — namespace is omitted from the key/display when a resource doesn't set it, since it's an optional OTel field, not a required one.
