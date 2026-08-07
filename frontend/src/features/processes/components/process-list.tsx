"use client";

import { Workflow } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessesQuery } from "@/features/processes/api/use-processes-query";
import { ProcessCard } from "@/features/processes/components/process-card";
import { ApiError } from "@/lib/api/errors";

const SKELETON_CARDS = [1, 2, 3] as const;

function ProcessListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando procesos"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {SKELETON_CARDS.map((card) => (
        <Card aria-hidden="true" className="min-h-56" key={card}>
          <CardHeader>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-36 motion-reduce:animate-none" />
              <Skeleton className="h-6 w-20 motion-reduce:animate-none" />
            </div>
            <Skeleton className="mt-3 h-6 w-2/3 motion-reduce:animate-none" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProcessList() {
  const { data, error, isError, isPending, refetch } = useProcessesQuery();

  if (isPending) {
    return <ProcessListSkeleton />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        description={
          error instanceof ApiError
            ? error.message
            : "No se pudieron cargar los procesos."
        }
        retry={() => void refetch()}
        title="No pudimos cargar los procesos."
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        description="No hay procesos disponibles."
        icon={<Workflow />}
        title="No hay procesos disponibles."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((process) => (
        <ProcessCard key={process.id} process={process} />
      ))}
    </div>
  );
}
