import type { ProcessRead } from "@/features/processes/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

export function getProcess(processId: number): Promise<ProcessRead> {
  if (!isPositiveInteger(processId)) {
    throw new TypeError("El identificador del proceso no es válido.");
  }

  return apiFetch<ProcessRead>(`/api/backend/procesos/${processId}`);
}
