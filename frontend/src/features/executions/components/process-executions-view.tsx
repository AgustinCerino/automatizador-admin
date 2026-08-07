"use client";

import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessExecutionsQuery } from "@/features/executions/api/use-process-executions-query";
import { ExecutionsTable } from "@/features/executions/components/executions-table";
import { NewExecutionDialog } from "@/features/executions/components/new-execution-dialog";
import { useProcessQuery } from "@/features/processes/api/use-process-query";
import { ApiError } from "@/lib/api/errors";

interface ProcessExecutionsViewProps {
  processId: number;
}

function ExecutionsSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Cargando ejecuciones">
      <CardHeader>
        <Skeleton className="h-6 w-48 motion-reduce:animate-none" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((row) => (
          <Skeleton
            className="h-10 w-full motion-reduce:animate-none"
            key={row}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function ProcessExecutionsView({
  processId,
}: ProcessExecutionsViewProps) {
  const processQuery = useProcessQuery(processId);
  const executionsQuery = useProcessExecutionsQuery(processId);

  if (processQuery.isPending) {
    return <ExecutionsSkeleton />;
  }

  if (processQuery.isError || !processQuery.data) {
    return (
      <ErrorState
        description={
          processQuery.error instanceof ApiError
            ? processQuery.error.message
            : "No se pudo cargar el proceso."
        }
        retry={() => void processQuery.refetch()}
        title="No pudimos cargar el proceso."
      />
    );
  }

  const process = processQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        action={<NewExecutionDialog process={process} />}
        breadcrumbs={[
          { label: "Procesos", href: "/procesos" },
          { label: process.nombre },
        ]}
        description="Ejecuciones"
        title={process.nombre}
      />

      {executionsQuery.isPending ? <ExecutionsSkeleton /> : null}

      {executionsQuery.isError ? (
        <ErrorState
          description={
            executionsQuery.error instanceof ApiError
              ? executionsQuery.error.message
              : "No se pudieron cargar las ejecuciones."
          }
          retry={() => void executionsQuery.refetch()}
          title="No pudimos cargar las ejecuciones."
        />
      ) : null}

      {executionsQuery.data ? (
        <ExecutionsTable
          emptyAction={<NewExecutionDialog process={process} />}
          executions={executionsQuery.data}
          processType={process.tipo}
        />
      ) : null}
    </div>
  );
}
