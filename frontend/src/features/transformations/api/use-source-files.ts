"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  inspectTransformationSourceFile,
  listTransformationSourceFiles,
  uploadTransformationSourceFile,
} from "@/features/transformations/api/source-files-api";
import {
  useRedirectOnSessionExpired,
  useSessionExpiredHandler,
} from "@/lib/auth/use-session-expired";
import { isPositiveInteger } from "@/lib/identifiers";
import { queryKeys } from "@/lib/query/query-keys";
import { shouldRetryQuery } from "@/lib/query/retry-policy";

export function useTransformationSourceFilesQuery(executionId: number) {
  const query = useQuery({
    enabled: isPositiveInteger(executionId),
    queryFn: () => listTransformationSourceFiles(executionId),
    queryKey: queryKeys.transformations.sourceFiles(executionId),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}

export function useUploadTransformationSourceFile(executionId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();

  return useMutation({
    mutationFn: (file: File) => uploadTransformationSourceFile(executionId, file),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transformations.sourceFiles(executionId),
      });
    },
  });
}

interface SourceStructureQueryOptions {
  executionId: number;
  fileId: number | null;
  headerRow: number;
  sheet: string | null;
}

export function useTransformationSourceStructureQuery({
  executionId,
  fileId,
  headerRow,
  sheet,
}: SourceStructureQueryOptions) {
  const validFileId = fileId !== null && isPositiveInteger(fileId);
  const query = useQuery({
    enabled:
      isPositiveInteger(executionId) && validFileId && isPositiveInteger(headerRow),
    queryFn: () =>
      inspectTransformationSourceFile({
        executionId,
        fileId: fileId as number,
        headerRow,
        sheet,
      }),
    queryKey: queryKeys.transformations.sourceStructure(
      executionId,
      fileId ?? 0,
      sheet,
      headerRow,
    ),
    retry: shouldRetryQuery,
    staleTime: 15_000,
  });
  useRedirectOnSessionExpired(query.error);
  return query;
}
