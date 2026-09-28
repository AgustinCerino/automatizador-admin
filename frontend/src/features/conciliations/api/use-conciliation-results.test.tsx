import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateConciliationRevision } from "@/features/conciliations/api/use-conciliation-results";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/query-keys";

const mocks = vi.hoisted(() => ({
  execution: vi.fn(),
  results: vi.fn(),
  revisionSummary: vi.fn(),
  updateRevision: vi.fn(),
}));

vi.mock("@/features/conciliations/api/conciliation-results-api", () => ({
  executeConciliation: vi.fn(),
  getConciliationRevisionSummary: vi.fn(),
  getConciliationResults: vi.fn(),
  updateConciliationRevision: mocks.updateRevision,
}));

vi.mock("@/lib/auth/use-session-expired", () => ({
  useRedirectOnSessionExpired: vi.fn(),
  useSessionExpiredHandler: () => vi.fn(),
}));

function ActiveQueries({ children }: { children: ReactNode }) {
  useQuery({
    queryFn: mocks.results,
    queryKey: queryKeys.conciliations.results(31),
  });
  useQuery({
    queryFn: mocks.revisionSummary,
    queryKey: queryKeys.conciliations.revisionSummary(31),
  });
  useQuery({
    queryFn: mocks.execution,
    queryKey: queryKeys.executions.detail(31),
  });
  return children;
}

describe("useUpdateConciliationRevision", () => {
  beforeEach(() => {
    mocks.results.mockReset().mockResolvedValue([]);
    mocks.revisionSummary.mockReset().mockResolvedValue({ pendientes_revision: 0 });
    mocks.execution.mockReset().mockResolvedValue({ id: 31 });
    mocks.updateRevision.mockReset().mockRejectedValue(
      new ApiError(409, {
        code: "CONFLICT",
        message: "La revisión cambió en el servidor.",
      }),
    );
  });

  it("no reintenta el PATCH y reconsulta resultados, resumen y ejecución tras 409", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ActiveQueries>{children}</ActiveQueries>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateConciliationRevision(31), {
      wrapper,
    });
    await waitFor(() => {
      expect(mocks.results).toHaveBeenCalledTimes(1);
      expect(mocks.revisionSummary).toHaveBeenCalledTimes(1);
      expect(mocks.execution).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        resultId: 71,
        update: {
          expected_updated_at: "2026-08-21T12:00:00Z",
          observacion: "Versión V1",
          requiere_revision: false,
        },
      })).rejects.toMatchObject({ status: 409 });
    });

    expect(mocks.updateRevision).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.results).toHaveBeenCalledTimes(2);
      expect(mocks.revisionSummary).toHaveBeenCalledTimes(2);
      expect(mocks.execution).toHaveBeenCalledTimes(2);
    });
  });
});
