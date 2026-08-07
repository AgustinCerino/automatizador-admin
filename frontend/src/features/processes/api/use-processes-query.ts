"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getProcesses,
  type ProcessListResponse,
} from "@/features/processes/api/get-processes";
import { useRedirectOnSessionExpired } from "@/lib/auth/use-session-expired";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useProcessesQuery() {
  const query = useQuery<ProcessListResponse, Error>({
    queryFn: getProcesses,
    queryKey: queryKeys.processes.list(),
    retry: shouldRetryQuery,
    staleTime: 30_000,
  });

  useRedirectOnSessionExpired(query.error);
  return query;
}
