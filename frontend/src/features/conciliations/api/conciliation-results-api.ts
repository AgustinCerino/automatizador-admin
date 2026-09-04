import type {
  ConciliationResult,
  ConciliationSummary,
} from "@/features/conciliations/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

function assertExecutionId(executionId: number): void {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }
}

export function executeConciliation(
  executionId: number,
): Promise<ConciliationSummary> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/ejecutar`, {
    method: "POST",
  });
}

export function getConciliationResults(
  executionId: number,
): Promise<ConciliationResult[]> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/resultados`, {
    method: "GET",
  });
}
