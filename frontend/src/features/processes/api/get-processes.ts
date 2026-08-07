import { apiFetch } from "@/lib/api/client";
import type { paths } from "@/types/generated/api";

export type ProcessListResponse =
  paths["/procesos"]["get"]["responses"][200]["content"]["application/json"];

export function getProcesses(): Promise<ProcessListResponse> {
  return apiFetch<ProcessListResponse>("/api/backend/procesos");
}
