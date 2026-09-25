import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaveConciliationMapping } from "@/features/conciliations/api/use-conciliation-files";
import { queryKeys } from "@/lib/query/query-keys";

const mocks = vi.hoisted(() => ({
  saveMapping: vi.fn(),
}));

vi.mock("@/features/conciliations/api/conciliation-files-api", () => ({
  getConciliationFilePreview: vi.fn(),
  getConciliationFileSelection: vi.fn(),
  getConciliationMapping: vi.fn(),
  listConciliationFiles: vi.fn(),
  saveConciliationFileSelection: vi.fn(),
  saveConciliationMapping: mocks.saveMapping,
  uploadConciliationFile: vi.fn(),
}));

vi.mock("@/lib/auth/use-session-expired", () => ({
  useRedirectOnSessionExpired: vi.fn(),
  useSessionExpiredHandler: () => vi.fn(),
}));

const MAPPING = {
  archivo_a_id: 1,
  archivo_b_id: 2,
  columna_clave_archivo_a: "Factura",
  columna_clave_archivo_b: "Comprobante",
  columna_importe_archivo_a: "Importe",
  columna_importe_archivo_b: "Monto",
  detectar_duplicados: true,
  tolerancia_importe: 0,
};

describe("useSaveConciliationMapping", () => {
  beforeEach(() => {
    mocks.saveMapping.mockReset().mockResolvedValue({
      ...MAPPING,
      columnas_archivo_a: ["Factura", "Importe"],
      columnas_archivo_b: ["Comprobante", "Monto"],
    });
  });

  it("descarta resultados cacheados y reconsulta la ejecución al guardar", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.conciliations.results(31), [{ id: 71 }]);
    queryClient.setQueryData(
      queryKeys.conciliations.revisionSummary(31),
      { pendientes_revision: 1 },
    );
    queryClient.setQueryData(
      queryKeys.executions.detail(31),
      { id: 31, resumen_json: { conciliacion_resumen: { total_resultados: 1 } } },
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveConciliationMapping(31), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(MAPPING);
    });

    expect(queryClient.getQueryData(queryKeys.conciliations.results(31))).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.conciliations.revisionSummary(31)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryState(queryKeys.executions.detail(31))?.isInvalidated,
    ).toBe(true);
    expect(queryClient.getQueryData(queryKeys.conciliations.mapping(31))).toMatchObject(MAPPING);
  });
});
