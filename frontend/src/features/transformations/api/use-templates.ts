"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyTransformationTemplate,
  createTransformationTemplate,
  deactivateTransformationTemplate,
  listTransformationTemplates,
  updateTransformationTemplate,
} from "@/features/transformations/api/templates-api";
import type {
  TransformationTemplateApply,
  TransformationTemplateCreate,
  TransformationTemplateUpdate,
} from "@/features/transformations/types";
import {
  useRedirectOnSessionExpired,
  useSessionExpiredHandler,
} from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useTransformationTemplatesQuery(
  executionId: number,
  processId: number,
) {
  const query = useQuery({
    enabled: isPositiveInteger(executionId) && isPositiveInteger(processId),
    queryFn: () => listTransformationTemplates(executionId),
    queryKey: queryKeys.transformations.templates(processId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useCreateTransformationTemplate(
  executionId: number,
  processId: number,
) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (input: TransformationTemplateCreate) =>
      createTransformationTemplate(executionId, input),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transformations.templates(processId),
      });
    },
  });
}

export function useApplyTransformationTemplate(
  executionId: number,
  processId: number,
) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: ({
      input,
      templateId,
    }: {
      input: TransformationTemplateApply;
      templateId: number;
    }) => applyTransformationTemplate(executionId, templateId, input),
    onError: handleSessionExpired,
    onSuccess: async (configuration) => {
      queryClient.setQueryData(
        queryKeys.transformations.configuration(executionId),
        configuration,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.transformations.summary(executionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transformations.templates(processId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transformations.trace(executionId),
        }),
      ]);
    },
  });
}

export function useUpdateTransformationTemplate(
  executionId: number,
  processId: number,
) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: ({
      input,
      templateId,
    }: {
      input: TransformationTemplateUpdate;
      templateId: number;
    }) => updateTransformationTemplate(executionId, templateId, input),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transformations.templates(processId),
      });
    },
  });
}

export function useDeactivateTransformationTemplate(
  executionId: number,
  processId: number,
) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (templateId: number) =>
      deactivateTransformationTemplate(executionId, templateId),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transformations.templates(processId),
      });
    },
  });
}
