import type {
  ConciliationResult,
  ConciliationRevisionSummary,
  ConciliationRevisionUpdate,
  RejectConciliationRequest,
  ConciliationSummary,
} from "@/features/conciliations/types";
import { apiFetch } from "@/lib/api/client";
import { createApiError } from "@/lib/api/errors";
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

export function approveConciliation(
  executionId: number,
): Promise<ConciliationRevisionSummary> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/aprobar`, {
    method: "POST",
  });
}

export function rejectConciliation(
  executionId: number,
  rejection: RejectConciliationRequest,
): Promise<ConciliationRevisionSummary> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/rechazar`, {
    body: rejection,
    method: "POST",
  });
}

function getDownloadFilename(contentDisposition: string | null): string {
  const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const encoded = utf8Match?.[1] ?? plainMatch?.[1];
  if (!encoded) return "conciliacion.xlsx";
  try {
    return decodeURIComponent(encoded).replace(/[\\/]/g, "_");
  } catch {
    return "conciliacion.xlsx";
  }
}

export async function downloadConciliationExport(
  executionId: number,
): Promise<void> {
  assertExecutionId(executionId);
  const response = await fetch(
    `/api/backend/conciliaciones/${executionId}/exportar`,
    { credentials: "same-origin", method: "GET" },
  );
  if (!response.ok) throw await createApiError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getDownloadFilename(
    response.headers.get("content-disposition"),
  );
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
