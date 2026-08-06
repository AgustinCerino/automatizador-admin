"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getHealth,
  type HealthResponse,
} from "@/features/system/api/get-health";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export interface HealthQueryResult {
  data: HealthResponse | undefined;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  refetch: () => Promise<unknown>;
}

export function useHealthQuery(): HealthQueryResult {
  const query = useQuery<HealthResponse, Error>({
    queryFn: getHealth,
    queryKey: queryKeys.system.health,
    refetchOnWindowFocus: false,
    retry: shouldRetryQuery,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    error: query.error,
    isError: query.isError,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
