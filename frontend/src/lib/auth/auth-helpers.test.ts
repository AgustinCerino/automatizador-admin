import { describe, expect, it } from "vitest";

import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookie-config";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { sanitizeInternalRedirect } from "@/lib/auth/redirect";

describe("sanitizeInternalRedirect", () => {
  it.each([
    "/",
    "/procesos",
    "/ejecuciones",
    "/plantillas",
    "/ruta?query=valor",
  ])("conserva el destino interno %s", (destination) => {
    expect(sanitizeInternalRedirect(destination)).toBe(destination);
  });

  it.each([
    "http://externo.test/ruta",
    "https://externo.test/ruta",
    "//externo.test/ruta",
    "javascript:alert(1)",
    "data:text/html,contenido",
    "/ruta\\externa",
    "/%5Cexterna",
    "",
    "   ",
    "/%zz",
    undefined,
    null,
    ["/procesos", "/plantillas"],
  ])("reemplaza el destino no permitido %# con el fallback", (destination) => {
    expect(sanitizeInternalRedirect(destination)).toBe("/");
  });
});

describe("isSameOriginRequest", () => {
  it("acepta un Origin que coincide con el origen del request", () => {
    const request = new Request("https://app.test/api/auth/login", {
      headers: { Origin: "https://app.test" },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("acepta requests sin Origin", () => {
    expect(
      isSameOriginRequest(new Request("https://app.test/api/auth/logout")),
    ).toBe(true);
  });

  it.each([
    "https://externo.test",
    "null",
    "https://app.test/ruta",
  ])("rechaza el Origin no permitido %s", (origin) => {
    const request = new Request("https://app.test/api/auth/login", {
      headers: { Origin: origin },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});

describe("configuración de la cookie de sesión", () => {
  it("mantiene estable el nombre y los flags en desarrollo", () => {
    const options = getSessionCookieOptions("development");

    expect(SESSION_COOKIE_NAME).toBe("automatizador_session");
    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(options).not.toHaveProperty("domain");
    expect(options).not.toHaveProperty("expires");
    expect(options).not.toHaveProperty("maxAge");
  });

  it("activa Secure únicamente en producción", () => {
    expect(getSessionCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(getSessionCookieOptions("test").secure).toBe(false);
  });
});
