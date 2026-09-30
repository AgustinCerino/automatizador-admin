import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateTransformationResult } from "@/features/transformations/api/configuration-api";
import { useGenerateTransformationResult } from "@/features/transformations/api/use-configuration";
import { queryKeys } from "@/lib/query/query-keys";

vi.mock("@/features/transformations/api/configuration-api", () => ({
  generateTransformationResult: vi.fn(),
}));
vi.mock("@/lib/auth/use-session-expired", () => ({
  useRedirectOnSessionExpired: vi.fn(),
  useSessionExpiredHandler: () => vi.fn(),
}));

const generateMock = vi.mocked(generateTransformationResult);

describe("mutaciones de Transformación Excel", () => {
  beforeEach(() => generateMock.mockReset());

  it("actualiza resumen y trazabilidad después de generar", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    generateMock.mockResolvedValue({
      archivo_id: 8,
      checksum: "abc123",
      columnas_salida: ["A", "B"],
      ejecucion_id: 31,
      estado_ejecucion: "COMPLETADO",
      extension: ".xlsx",
      generated_at: "2026-08-07T12:00:00Z",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      nombre_archivo: "resultado.xlsx",
      reused: false,
      size_bytes: 2048,
      total_filas: 4,
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useGenerateTransformationResult(31), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.transformations.summary(31),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.transformations.trace(31),
    });
  });
});
