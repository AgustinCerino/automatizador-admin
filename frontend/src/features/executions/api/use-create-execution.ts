"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createExecution } from "@/features/executions/api/create-execution";
import { useSessionExpiredHandler } from "@/lib/auth/use-session-expired";
import { queryKeys } from "@/lib/query/query-keys";

export function useCreateExecution(processId: number) {
  const queryClient = useQueryClient();
  const handleSessionExpired = useSessionExpiredHandler();

  return useMutation({
    mutationFn: () => createExecution({ proceso_id: processId }),
    onError: handleSessionExpired,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.executions.byProcess(processId),
      });
    },
  });
}
