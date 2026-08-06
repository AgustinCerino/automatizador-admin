import { apiFetch } from "@/lib/api/client";
import type { paths } from "@/types/generated/api";

export type HealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/backend/health");
}
