import { isPositiveInteger } from "@/lib/identifiers";

export function getExecutionHref(
  processType: string,
  executionId: number,
): string | undefined {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }

  return processType === "TRANSFORMACION_EXCEL"
    ? `/transformaciones/${executionId}`
    : undefined;
}
