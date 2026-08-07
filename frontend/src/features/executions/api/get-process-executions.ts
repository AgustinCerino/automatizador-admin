import type { ExecutionRead } from "@/features/executions/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

export function getProcessExecutions(
  processId: number,
): Promise<ExecutionRead[]> {
  if (!isPositiveInteger(processId)) {
    throw new TypeError("El identificador del proceso no es válido.");
  }

  return apiFetch<ExecutionRead[]>(
    `/api/backend/procesos/${processId}/ejecuciones`,
  );
}
