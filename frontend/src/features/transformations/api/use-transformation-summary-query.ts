"use client";

import { useQuery } from "@tanstack/react-query";

import { getTransformationSummary } from "@/features/transformations/api/get-transformation-summary";
import type { TransformationSummary } from "@/features/transformations/types";
import { useRedirectOnSessionExpired } from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export const PROCESSING_REFETCH_INTERVAL_MS = 3_000;

export function getTransformationSummaryRefetchInterval(
  summary: TransformationSummary | undefined,
): number | false {
  return summary?.estado_ejecucion === "PROCESANDO"
    ? PROCESSING_REFETCH_INTERVAL_MS
    : false;
}

export function useTransformationSummaryQuery(executionId: number) {
  const query = useQuery<TransformationSummary, Error>({
    enabled: isPositiveInteger(executionId),
    queryFn: () => getTransformationSummary(executionId),
    queryKey: queryKeys.transformations.summary(executionId),
    refetchInterval: (currentQuery) =>
      getTransformationSummaryRefetchInterval(currentQuery.state.data),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });

  useRedirectOnSessionExpired(query.error);
  return query;
}
