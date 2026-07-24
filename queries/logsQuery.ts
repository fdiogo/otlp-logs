import { ExportLogsServiceRequest } from "@/app/generated/opentelemetry/proto/collector/logs/v1/logs_service";
import { queryOptions } from "@tanstack/react-query";

export const logsQuery = queryOptions({
  queryKey: ["logs"],
  staleTime: Infinity,
  queryFn: async ({ signal }) => {
    {
      const res = await fetch(
        "https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs",
        { signal },
      );
      const json: ExportLogsServiceRequest = await res.json();

      return json;
    }
  },
});
