import type {
  ConciliationFile,
  ConciliationFilePreview,
  ConciliationFileSelection,
} from "@/features/conciliations/types";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { isPositiveInteger } from "@/lib/identifiers";

function assertIdentifier(value: number, label: string): void {
  if (!isPositiveInteger(value)) {
    throw new TypeError(`El identificador ${label} no es válido.`);
  }
}

export function listConciliationFiles(
  executionId: number,
): Promise<ConciliationFile[]> {
  assertIdentifier(executionId, "de la ejecución");
  return apiFetch(`/api/backend/conciliaciones/${executionId}/archivos-disponibles`, {
    method: "GET",
  });
}

export function uploadConciliationFile(
  executionId: number,
  file: File,
): Promise<ConciliationFile> {
  assertIdentifier(executionId, "de la ejecución");
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiFetch(`/api/backend/conciliaciones/${executionId}/archivos-disponibles`, {
    body: formData,
    method: "POST",
  });
}

export async function getConciliationFileSelection(
  executionId: number,
): Promise<ConciliationFileSelection | null> {
  assertIdentifier(executionId, "de la ejecución");
  try {
    return await apiFetch(`/api/backend/conciliaciones/${executionId}/archivos`, {
      method: "GET",
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === "CONCILIATION_SELECTION_NOT_FOUND"
    ) {
      return null;
    }
    throw error;
  }
}

export function saveConciliationFileSelection(
  executionId: number,
  selection: ConciliationFileSelection,
): Promise<ConciliationFileSelection> {
  assertIdentifier(executionId, "de la ejecución");
  return apiFetch(`/api/backend/conciliaciones/${executionId}/archivos`, {
    body: selection,
    method: "PUT",
  });
}

export function getConciliationFilePreview(
  executionId: number,
  fileId: number,
): Promise<ConciliationFilePreview> {
  assertIdentifier(executionId, "de la ejecución");
  assertIdentifier(fileId, "del archivo");
  return apiFetch(
    `/api/backend/conciliaciones/${executionId}/archivos/${fileId}/preview`,
    { method: "GET" },
  );
}
