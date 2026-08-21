"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getConciliationFilePreview,
  getConciliationFileSelection,
  getConciliationMapping,
  listConciliationFiles,
  saveConciliationFileSelection,
  saveConciliationMapping,
  uploadConciliationFile,
} from "@/features/conciliations/api/conciliation-files-api";
import type { ConciliationFileSelection, ConciliationMappingCreate } from "@/features/conciliations/types";
import {
  useRedirectOnSessionExpired,
  useSessionExpiredHandler,
} from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useConciliationFilesQuery(executionId: number) {
  const query = useQuery({
    enabled: isPositiveInteger(executionId),
    queryFn: () => listConciliationFiles(executionId),
    queryKey: queryKeys.conciliations.files(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useConciliationSelectionQuery(executionId: number) {
  const query = useQuery({
    enabled: isPositiveInteger(executionId),
    queryFn: () => getConciliationFileSelection(executionId),
    queryKey: queryKeys.conciliations.selection(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useSaveConciliationSelection(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (selection: ConciliationFileSelection) =>
      saveConciliationFileSelection(executionId, selection),
    onError: handleSessionExpired,
    onSuccess: (selection) => {
      queryClient.setQueryData(
        queryKeys.conciliations.selection(executionId),
        selection,
      );
    },
  });
}

export function useConciliationMappingQuery(executionId: number) {
  const query = useQuery({
    enabled: isPositiveInteger(executionId),
    queryFn: () => getConciliationMapping(executionId),
    queryKey: queryKeys.conciliations.mapping(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useSaveConciliationMapping(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (mapping: ConciliationMappingCreate) =>
      saveConciliationMapping(executionId, mapping),
    onError: handleSessionExpired,
    onSuccess: (mapping) => {
      queryClient.setQueryData(queryKeys.conciliations.mapping(executionId), mapping);
    },
  });
}

export function useUploadConciliationFile(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();
  return useMutation({
    mutationFn: (file: File) => uploadConciliationFile(executionId, file),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conciliations.files(executionId),
      });
    },
  });
}

export function useConciliationPreviewQuery(
  executionId: number,
  fileId: number | null,
) {
  const validFileId = fileId !== null && isPositiveInteger(fileId);
  const query = useQuery({
    enabled: isPositiveInteger(executionId) && validFileId,
    queryFn: () => getConciliationFilePreview(executionId, fileId as number),
    queryKey: queryKeys.conciliations.preview(executionId, fileId ?? 0),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}
