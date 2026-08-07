"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { ApiError } from "@/lib/api/errors";

export function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === "SESSION_EXPIRED"
  );
}

export function useSessionExpiredHandler(): (error: unknown) => boolean {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);

  return useCallback(
    (error: unknown) => {
      if (
        handled.current ||
        pathname === "/login" ||
        !isSessionExpiredError(error)
      ) {
        return false;
      }

      handled.current = true;
      queryClient.clear();
      router.replace("/login");
      router.refresh();
      return true;
    },
    [pathname, queryClient, router],
  );
}

export function useRedirectOnSessionExpired(error: unknown): void {
  const handleSessionExpired = useSessionExpiredHandler();

  useEffect(() => {
    handleSessionExpired(error);
  }, [error, handleSessionExpired]);
}
