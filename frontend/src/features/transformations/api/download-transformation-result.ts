import { ApiError, createApiError } from "@/lib/api/errors";
import { isPositiveInteger } from "@/lib/identifiers";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function getDownloadFilename(
  contentDisposition: string | null,
  fallbackFilename: string,
): string {
  const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const encoded = utf8Match?.[1] ?? plainMatch?.[1];

  if (!encoded) return fallbackFilename;

  try {
    return decodeURIComponent(encoded).replace(/[\\/]/g, "_");
  } catch {
    return fallbackFilename;
  }
}

export async function downloadTransformationResult(
  executionId: number,
  fallbackFilename = "resultado.xlsx",
): Promise<void> {
  if (!isPositiveInteger(executionId)) {
    throw new TypeError("El identificador de la ejecución no es válido.");
  }

  const response = await fetch(
    `/api/backend/transformaciones/${executionId}/resultado/descargar`,
    {
      credentials: "same-origin",
      headers: { Accept: XLSX_CONTENT_TYPE },
      method: "GET",
    },
  );

  if (!response.ok) throw await createApiError(response);

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("spreadsheetml.sheet")) {
    throw new ApiError(response.status, {
      message: "La descarga no devolvió un archivo XLSX válido.",
    });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getDownloadFilename(
    response.headers.get("content-disposition"),
    fallbackFilename,
  );
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
