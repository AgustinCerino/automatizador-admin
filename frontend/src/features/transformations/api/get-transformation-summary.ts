import type { TransformationSummary } from "@/features/transformations/types";
import { apiFetch } from "@/lib/api/client";
import { isPositiveInteger } from "@/lib/identifiers";

export function getTransformationSummary(
  executionId: number,
): Promise<TransformationSummary> {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }

  return apiFetch<TransformationSummary>(
    `/api/backend/transformaciones/${executionId}/resumen`,
    { method: "GET" },
  );
}
