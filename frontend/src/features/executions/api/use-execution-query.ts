"use client";

import { useQuery } from "@tanstack/react-query";

import { getExecution } from "@/features/executions/api/get-execution";
import type { ExecutionRead } from "@/features/executions/types";
import { useRedirectOnSessionExpired } from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useExecutionQuery(executionId: number) {
  const query = useQuery<ExecutionRead, Error>({
    enabled: isPositiveInteger(executionId),
    queryFn: () => getExecution(executionId),
    queryKey: queryKeys.executions.detail(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });

  useRedirectOnSessionExpired(query.error);
  return query;
}
