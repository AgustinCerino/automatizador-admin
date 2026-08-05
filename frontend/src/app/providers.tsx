"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/lib/query/query-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      {children}
      <Toaster closeButton position="top-right" />
    </QueryProvider>
  );
}
