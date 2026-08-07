"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutionQuery } from "@/features/executions/api/use-execution-query";
import { useProcessQuery } from "@/features/processes/api/use-process-query";
import { ApiError } from "@/lib/api/errors";

interface TransformationExecutionViewProps {
  executionId: number;
}

export function TransformationExecutionView({
  executionId,
}: TransformationExecutionViewProps) {
  const executionQuery = useExecutionQuery(executionId);
  const processQuery = useProcessQuery(executionQuery.data?.proceso_id ?? 0);

  if (executionQuery.isPending || (executionQuery.data && processQuery.isPending)) {
    return (
      <div aria-busy="true" aria-label="Cargando ejecución" className="space-y-6">
        <Skeleton className="h-9 w-72 motion-reduce:animate-none" />
        <Skeleton className="h-48 w-full motion-reduce:animate-none" />
      </div>
    );
  }

  const error = executionQuery.error ?? processQuery.error;

  if (
    executionQuery.isError ||
    processQuery.isError ||
    !executionQuery.data ||
    !processQuery.data
  ) {
    return (
      <ErrorState
        description={
          error instanceof ApiError
            ? error.message
            : "No se pudo cargar la ejecución."
        }
        retry={() => {
          void executionQuery.refetch();
          if (executionQuery.data) void processQuery.refetch();
        }}
        title="No pudimos cargar la ejecución."
      />
    );
  }

  const execution = executionQuery.data;
  const process = processQuery.data;

  if (process.tipo !== "TRANSFORMACION_EXCEL") {
    return (
      <ErrorState
        description="El recurso solicitado no existe."
        title="Esta ejecución no es una transformación Excel."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Procesos", href: "/procesos" },
          {
            label: process.nombre,
            href: `/procesos/${process.id}/ejecuciones`,
          },
          { label: `Ejecución #${execution.id}` },
        ]}
        description={`Ejecución #${execution.id}`}
        title="Transformación Excel"
      />

      <Card>
        <CardHeader>
          <CardTitle>Estado de la ejecución</CardTitle>
          <CardDescription>{process.nombre}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <StatusBadge status={execution.estado} />
          <p className="text-sm leading-6 text-muted-foreground">
            El espacio de trabajo de esta ejecución se incorporará en el
            siguiente paso.
          </p>
          <Button asChild variant="outline">
            <Link href={`/procesos/${execution.proceso_id}/ejecuciones`}>
              <ArrowLeft aria-hidden="true" />
              Volver a ejecuciones
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
