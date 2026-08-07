import type {
  TransformationSourceFile,
  TransformationSourceStructure,
} from "@/features/transformations/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

function assertIdentifier(value: number, label: string): void {
  if (!isPositiveInteger(value)) {
    throw new TypeError(`El identificador ${label} no es válido.`);
  }
}

export function listTransformationSourceFiles(
  executionId: number,
): Promise<TransformationSourceFile[]> {
  assertIdentifier(executionId, "de la ejecución");
  return apiFetch(`/api/backend/transformaciones/${executionId}/archivos`, {
    method: "GET",
  });
}

export function uploadTransformationSourceFile(
  executionId: number,
  file: File,
): Promise<TransformationSourceFile> {
  assertIdentifier(executionId, "de la ejecución");
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiFetch(`/api/backend/transformaciones/${executionId}/archivos`, {
    body: formData,
    method: "POST",
  });
}

export interface InspectTransformationSourceOptions {
  executionId: number;
  fileId: number;
  headerRow: number;
  sheet: string | null;
}

export function inspectTransformationSourceFile({
  executionId,
  fileId,
  headerRow,
  sheet,
}: InspectTransformationSourceOptions): Promise<TransformationSourceStructure> {
  assertIdentifier(executionId, "de la ejecución");
  assertIdentifier(fileId, "del archivo");
  if (!isPositiveInteger(headerRow)) {
    throw new TypeError("La fila de encabezado no es válida.");
  }

  const query = new URLSearchParams({ headerRow: String(headerRow) });
  if (sheet !== null) query.set("sheet", sheet);

  return apiFetch(
    `/api/backend/transformaciones/${executionId}/archivos/${fileId}/estructura?${query.toString()}`,
    { method: "GET" },
  );
}
