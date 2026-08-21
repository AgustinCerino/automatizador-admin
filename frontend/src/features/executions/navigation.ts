import { isPositiveInteger } from "@/lib/identifiers";

export function getExecutionHref(
  processType: string,
  executionId: number,
): string | undefined {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }

  const routes: Readonly<Record<string, string>> = {
    CONCILIACION_EXCEL: `/conciliaciones/${executionId}`,
    TRANSFORMACION_EXCEL: `/transformaciones/${executionId}`,
  };
  return routes[processType];
}
