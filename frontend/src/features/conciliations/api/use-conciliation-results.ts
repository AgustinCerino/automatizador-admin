"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  executeConciliation,
  getConciliationResults,
} from "@/features/conciliations/api/conciliation-results-api";
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
