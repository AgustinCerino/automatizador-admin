import { describe, expect, it } from "vitest";

import {
  ApiError,
  createApiError,
  getFallbackErrorMessage,
  normalizeApiErrorPayload,
} from "@/lib/api/errors";

describe("normalizeApiErrorPayload", () => {
  it("normaliza el detail de texto de FastAPI", () => {
    expect(
      normalizeApiErrorPayload(400, { detail: "El dato es incorrecto." }),
    ).toEqual({ message: "El dato es incorrecto." });
  });

  it("conserva los detalles de validación y usa el mensaje seguro de 422", () => {
    const detail = [{ loc: ["body", "name"], msg: "Required" }];

    expect(normalizeApiErrorPayload(422, { detail })).toEqual({
      details: detail,
      message: "Los datos enviados no son válidos.",
    });
  });

  it("normaliza el contrato code y message", () => {
    expect(
      normalizeApiErrorPayload(409, {
        code: "INVALID_STATE",
        details: { field: "status" },
        message: "La operación está pendiente.",
      }),
    ).toEqual({
      code: "INVALID_STATE",
      details: { field: "status" },
      message: "La operación está pendiente.",
    });
  });

  it("acepta un cuerpo de texto plano", () => {
    expect(normalizeApiErrorPayload(400, "Solicitud incompleta.")).toEqual({
      message: "Solicitud incompleta.",
    });
  });

  it("usa el fallback para un cuerpo vacío", () => {
    expect(normalizeApiErrorPayload(404, undefined)).toEqual({
      message: "No se encontró el recurso solicitado.",
    });
  });

  it("no expone HTML recibido como mensaje", () => {
    expect(
      normalizeApiErrorPayload(500, "<html><body>Internal error</body></html>"),
    ).toEqual({
      message: "Ocurrió un error interno. Intentá nuevamente.",
    });
  });

  it("no expone URLs internas recibidas como mensaje", () => {
    expect(
      normalizeApiErrorPayload(503, "Falló http://127.0.0.1:8000/health"),
    ).toEqual({
      message: "Ocurrió un error interno. Intentá nuevamente.",
    });
  });

  it("no expone rutas internas recibidas como mensaje", () => {
    expect(
      normalizeApiErrorPayload(500, "GET /api/internal/health falló"),
    ).toEqual({
      message: "Ocurrió un error interno. Intentá nuevamente.",
    });
  });

  it("descarta códigos con formato no controlado", () => {
    expect(
      normalizeApiErrorPayload(400, {
        code: "<script>alert(1)</script>",
        message: "Solicitud incorrecta.",
      }),
    ).toEqual({ message: "Solicitud incorrecta." });
  });
});

describe("getFallbackErrorMessage", () => {
  it.each([
    [400, "La solicitud no es válida."],
    [401, "Tu sesión no es válida o ha vencido."],
    [403, "No tenés permisos para realizar esta acción."],
    [404, "No se encontró el recurso solicitado."],
    [409, "La operación no puede realizarse en el estado actual."],
    [413, "El archivo o contenido supera el límite permitido."],
    [422, "Los datos enviados no son válidos."],
    [500, "Ocurrió un error interno. Intentá nuevamente."],
    [503, "Ocurrió un error interno. Intentá nuevamente."],
  ])("devuelve el mensaje controlado para %i", (status, expectedMessage) => {
    expect(getFallbackErrorMessage(status)).toBe(expectedMessage);
  });
});

describe("ApiError", () => {
  it("expone sólo los datos normalizados del error", () => {
    const error = new ApiError(409, {
      code: "INVALID_STATE",
      details: { status: "PENDING" },
      message: "Estado inválido.",
    });

    expect(error).toMatchObject({
      code: "INVALID_STATE",
      details: { status: "PENDING" },
      message: "Estado inválido.",
      name: "ApiError",
      status: 409,
    });
    expect(error).not.toHaveProperty("response");
  });
});

describe("createApiError", () => {
  it("normaliza una respuesta JSON sin retener Response", async () => {
    const error = await createApiError(
      new Response(JSON.stringify({ code: "NOT_FOUND", message: "No existe." }), {
        headers: { "Content-Type": "application/json" },
        status: 404,
      }),
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "No existe.",
      status: 404,
    });
    expect(error).not.toHaveProperty("response");
  });

  it("usa el fallback si el JSON de error es inválido", async () => {
    const error = await createApiError(
      new Response("{invalid", {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }),
    );

    expect(error.message).toBe(
      "Ocurrió un error interno. Intentá nuevamente.",
    );
  });
});
