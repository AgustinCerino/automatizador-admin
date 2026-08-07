import type { ExecutionRead } from "@/features/executions/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

export function getExecution(executionId: number): Promise<ExecutionRead> {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }

  return apiFetch<ExecutionRead>(
    `/api/backend/ejecuciones/${executionId}`,
  );
}
