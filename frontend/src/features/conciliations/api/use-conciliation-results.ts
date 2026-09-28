"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveConciliation,
  downloadConciliationExport,
  executeConciliation,
  getConciliationRevisionSummary,
  getConciliationResults,
  rejectConciliation,
  updateConciliationRevision,
} from "@/features/conciliations/api/conciliation-results-api";
import { ApiError } from "@/lib/api/errors";
import { useRedirectOnSessionExpired, useSessionExpiredHandler } from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useConciliationResultsQuery(
  executionId: number,
  enabled: boolean,
) {
  const query = useQuery({
    enabled: enabled && isPositiveInteger(executionId),
    queryFn: () => getConciliationResults(executionId),
    queryKey: queryKeys.conciliations.results(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useExecuteConciliation(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: () => executeConciliation(executionId),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.results(executionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.executions.detail(executionId) }),
      ]);
    },
  });
}

export function useConciliationRevisionSummaryQuery(executionId: number, enabled: boolean) {
  const query = useQuery({
    enabled: enabled && isPositiveInteger(executionId),
    queryFn: () => getConciliationRevisionSummary(executionId),
    queryKey: queryKeys.conciliations.revisionSummary(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useUpdateConciliationRevision(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: ({ resultId, update }: { resultId: number; update: import("@/features/conciliations/types").ConciliationRevisionUpdate }) => updateConciliationRevision(executionId, resultId, update),
    onError: async (error) => {
      handleSessionExpired(error);
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.results(executionId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.revisionSummary(executionId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.executions.detail(executionId) }),
        ]);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.results(executionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.revisionSummary(executionId) }),
      ]);
    },
    retry: false,
  });
}

function useClosureInvalidation(executionId: number) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.results(executionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.conciliations.revisionSummary(executionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.executions.detail(executionId) }),
    ]);
  };
}

export function useApproveConciliation(executionId: number) {
  const handleSessionExpired = useSessionExpiredHandler();
  const invalidate = useClosureInvalidation(executionId);
  return useMutation({
    mutationFn: () => approveConciliation(executionId),
    onError: handleSessionExpired,
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRejectConciliation(executionId: number) {
  const handleSessionExpired = useSessionExpiredHandler();
  const invalidate = useClosureInvalidation(executionId);
  return useMutation({
    mutationFn: (motivo: string | null) =>
      rejectConciliation(executionId, { motivo }),
    onError: handleSessionExpired,
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDownloadConciliationExport(executionId: number) {
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: () => downloadConciliationExport(executionId),
    onError: handleSessionExpired,
    retry: false,
  });
}
