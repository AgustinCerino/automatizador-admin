import type {
  ConciliationResult,
  ConciliationRevisionSummary,
  ConciliationRevisionUpdate,
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

export function getConciliationRevisionSummary(executionId: number): Promise<ConciliationRevisionSummary> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/revision-resumen`, { method: "GET" });
}

export function updateConciliationRevision(
  executionId: number,
  resultId: number,
  update: ConciliationRevisionUpdate,
): Promise<ConciliationResult> {
  assertExecutionId(executionId);
  if (!isPositiveInteger(resultId)) throw new TypeError("El identificador del resultado no es válido.");
  return apiFetch(`/api/backend/conciliaciones/${executionId}/resultados/${resultId}/revision`, {
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}
