"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getTransformationConfiguration,
  saveTransformationConfiguration,
  validateTransformationConfiguration,
} from "@/features/transformations/api/configuration-api";
import type { TransformationExcelConfig } from "@/features/transformations/types";
import {
  useRedirectOnSessionExpired,
  useSessionExpiredHandler,
} from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useTransformationConfigurationQuery(executionId: number, enabled: boolean) {
  const query = useQuery({
    enabled: enabled && isPositiveInteger(executionId),
    queryFn: () => getTransformationConfiguration(executionId),
    queryKey: queryKeys.transformations.configuration(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useSaveTransformationConfiguration(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (configuration: TransformationExcelConfig) =>
      saveTransformationConfiguration(executionId, configuration),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transformations.configuration(executionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transformations.summary(executionId) }),
      ]);
    },
  });
}

export function useValidateTransformationConfiguration(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: () => validateTransformationConfiguration(executionId),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.transformations.summary(executionId) });
    },
  });
}
