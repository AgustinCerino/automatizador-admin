import type {
  ExecutionCreate,
  ExecutionRead,
} from "@/features/executions/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

export function createExecution(
  input: ExecutionCreate,
): Promise<ExecutionRead> {
  if (!isPositiveInteger(input.proceso_id)) {
    throw new TypeError("El identificador del proceso no es válido.");
  }

  return apiFetch<ExecutionRead>("/api/backend/ejecuciones", {
    body: { proceso_id: input.proceso_id },
    method: "POST",
  });
}
