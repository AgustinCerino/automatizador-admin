import {
  BackendRequestError,
  forwardBackendResponse,
} from "@/lib/api/server-utils";

type HealthBackendFetcher = (
  backendPath: string,
  options?: { cache?: RequestCache },
) => Promise<Response>;

const UNAVAILABLE_PAYLOAD = {
  code: "BACKEND_UNAVAILABLE",
  message: "El servidor de la aplicación no está disponible.",
};

const INTERNAL_ERROR_PAYLOAD = {
  code: "INTERNAL_SERVER_ERROR",
  message: "Ocurrió un error interno. Intentá nuevamente.",
};

function jsonErrorResponse(
  payload: typeof UNAVAILABLE_PAYLOAD | typeof INTERNAL_ERROR_PAYLOAD,
  status: number,
): Response {
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function handleHealthRequest(
  fetchBackend: HealthBackendFetcher,
): Promise<Response> {
  try {
    const backendResponse = await fetchBackend("/health", {
      cache: "no-store",
    });

    return forwardBackendResponse(backendResponse, {
      cacheControl: "no-store",
    });
  } catch (error) {
    if (error instanceof BackendRequestError) {
      console.error(`Health del backend falló (${error.kind}).`);

      if (error.kind === "configuration") {
        return jsonErrorResponse(INTERNAL_ERROR_PAYLOAD, 500);
      }

      return jsonErrorResponse(UNAVAILABLE_PAYLOAD, 503);
    }

    console.error("Health del backend falló (error inesperado).");
    return jsonErrorResponse(INTERNAL_ERROR_PAYLOAD, 500);
  }
}
