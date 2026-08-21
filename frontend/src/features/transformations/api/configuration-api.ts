import type {
  TransformationExcelConfig,
  TransformationExcelConfigRead,
  TransformationGenerationRead,
  TransformationValidationRead,
} from "@/features/transformations/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

function assertExecutionId(executionId: number): void {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecuci\u00f3n no es v\u00e1lido.");
  }
}

export function getTransformationConfiguration(
  executionId: number,
): Promise<TransformationExcelConfigRead> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/transformaciones/${executionId}/configuracion`, {
    method: "GET",
  });
}

export function saveTransformationConfiguration(
  executionId: number,
  configuration: TransformationExcelConfig,
): Promise<TransformationExcelConfigRead> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/transformaciones/${executionId}/configuracion`, {
    body: configuration,
    method: "POST",
  });
}

export function validateTransformationConfiguration(
  executionId: number,
): Promise<TransformationValidationRead> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/transformaciones/${executionId}/validar`, {
    method: "POST",
  });
}

export function generateTransformationResult(
  executionId: number,
): Promise<TransformationGenerationRead> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/transformaciones/${executionId}/generar`, {
    method: "POST",
  });
}

export function getTransformationResult(
  executionId: number,
): Promise<TransformationGenerationRead> {
  assertExecutionId(executionId);
  return apiFetch(`/api/backend/transformaciones/${executionId}/resultado`, {
    method: "GET",
  });
}
