import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

describe("shouldRetryQuery", () => {
  it.each([400, 401, 403, 404, 409, 413, 422])(
    "no reintenta errores HTTP %i",
    (status) => {
      expect(
        shouldRetryQuery(
          0,
          new ApiError(status, { message: "Error controlado." }),
        ),
      ).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])(
    "reintenta una vez errores HTTP transitorios %i",
    (status) => {
      const error = new ApiError(status, { message: "Error transitorio." });

      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(false);
    },
  );

  it("no reintenta otros errores HTTP", () => {
    expect(
      shouldRetryQuery(
        0,
        new ApiError(501, { message: "No implementado." }),
      ),
    ).toBe(false);
  });

  it("reintenta una vez errores de red", () => {
    const error = new TypeError("fetch failed");

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it("no reintenta valores que no son errores", () => {
    expect(shouldRetryQuery(0, "failure")).toBe(false);
  });
});
