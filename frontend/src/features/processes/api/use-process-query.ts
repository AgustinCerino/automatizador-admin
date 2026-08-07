"use client";

import { useQuery } from "@tanstack/react-query";

import { getProcess } from "@/features/processes/api/get-process";
import type { ProcessRead } from "@/features/processes/types";
import { useRedirectOnSessionExpired } from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useProcessQuery(processId: number) {
  const query = useQuery<ProcessRead, Error>({
    enabled: isPositiveInteger(processId),
    queryFn: () => getProcess(processId),
    queryKey: queryKeys.processes.detail(processId),
    retry: shouldRetryQuery,
    staleTime: 30_000,
  });

  useRedirectOnSessionExpired(query.error);
  return query;
}
