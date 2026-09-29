import type {
  TransformationExcelConfigRead,
  TransformationTemplateApply,
  TransformationTemplateCreate,
  TransformationTemplateListRead,
  TransformationTemplateRead,
  TransformationTemplateUpdate,
} from "@/features/transformations/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

function assertIdentifier(value: number, label: string): void {
  if (!isPositiveInteger(value)) {
    throw new TypeError(`El identificador de ${label} no es válido.`);
  }
}

function templatesPath(executionId: number): string {
  assertIdentifier(executionId, "la ejecución");
  return `/api/backend/transformaciones/${executionId}/plantillas`;
}

export function listTransformationTemplates(
  executionId: number,
): Promise<TransformationTemplateListRead> {
  return apiFetch(templatesPath(executionId), { method: "GET" });
}

export function createTransformationTemplate(
  executionId: number,
  input: TransformationTemplateCreate,
): Promise<TransformationTemplateRead> {
  return apiFetch(templatesPath(executionId), { body: input, method: "POST" });
}

export function applyTransformationTemplate(
  executionId: number,
  templateId: number,
  input: TransformationTemplateApply,
): Promise<TransformationExcelConfigRead> {
  assertIdentifier(templateId, "la plantilla");
  return apiFetch(`${templatesPath(executionId)}/${templateId}/aplicar`, {
    body: input,
    method: "POST",
  });
}

export function updateTransformationTemplate(
  executionId: number,
  templateId: number,
  input: TransformationTemplateUpdate,
): Promise<TransformationTemplateRead> {
  assertIdentifier(templateId, "la plantilla");
  return apiFetch(`${templatesPath(executionId)}/${templateId}`, {
    body: input,
    method: "PUT",
  });
}

export function deactivateTransformationTemplate(
  executionId: number,
  templateId: number,
): Promise<void> {
  assertIdentifier(templateId, "la plantilla");
  return apiFetch(`${templatesPath(executionId)}/${templateId}`, {
    method: "DELETE",
  });
}
