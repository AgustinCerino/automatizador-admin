"use client";

import { useQuery } from "@tanstack/react-query";

import { getProcessExecutions } from "@/features/executions/api/get-process-executions";
import type { ExecutionRead } from "@/features/executions/types";
import { useRedirectOnSessionExpired } from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useProcessExecutionsQuery(processId: number) {
  const query = useQuery<ExecutionRead[], Error>({
    enabled: isPositiveInteger(processId),
    queryFn: () => getProcessExecutions(processId),
    queryKey: queryKeys.executions.byProcess(processId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });

  useRedirectOnSessionExpired(query.error);
  return query;
}
