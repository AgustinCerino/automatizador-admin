import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExecutionsEmptyState } from "@/features/executions/components/executions-empty-state";
import { TransformationExecutionActions } from "@/features/executions/components/transformation-execution-actions";
import { getExecutionHref } from "@/features/executions/navigation";
import type { ExecutionRead } from "@/features/executions/types";
import { formatDateTime } from "@/lib/format-date";

interface ExecutionsTableProps {
  emptyAction: ReactNode;
  executions: readonly ExecutionRead[];
  processType: string;
}

interface TransformationGenerationSummary {
  nombre_archivo?: string;
  total_filas?: number;
}

function getTransformationGeneration(
  execution: ExecutionRead,
): TransformationGenerationSummary | undefined {
  const transformation = execution.resumen_json?.transformacion_excel;
  if (
    typeof transformation !== "object" ||
    transformation === null ||
    Array.isArray(transformation)
  ) {
    return undefined;
  }

  const generation = (transformation as Record<string, unknown>).generacion;
  if (
    typeof generation !== "object" ||
    generation === null ||
    Array.isArray(generation)
  ) {
    return undefined;
  }

  const raw = generation as Record<string, unknown>;
  return {
    nombre_archivo:
      typeof raw.nombre_archivo === "string" ? raw.nombre_archivo : undefined,
    total_filas:
      typeof raw.total_filas === "number" ? raw.total_filas : undefined,
  };
}

function ExecutionResult({
  execution,
  processType,
}: {
  execution: ExecutionRead;
  processType: string;
}) {
  if (execution.error_message) {
    return (
      <span className="line-clamp-2 text-sm text-destructive">
        {execution.error_message}
      </span>
    );
  }

  if (processType !== "TRANSFORMACION_EXCEL") {
    return <span className="text-muted-foreground">—</span>;
  }

  const generation = getTransformationGeneration(execution);
  if (!generation) {
    return <span className="text-sm text-muted-foreground">Pendiente</span>;
  }

  return (
    <div className="min-w-40 text-sm">
      <p className="font-medium">
        {generation.nombre_archivo ?? "Archivo generado"}
      </p>
      {generation.total_filas !== undefined ? (
        <p className="text-muted-foreground">
          {generation.total_filas.toLocaleString("es-AR")} filas
        </p>
      ) : null}
    </div>
  );
}

export function ExecutionsTable({
  emptyAction,
  executions,
  processType,
}: ExecutionsTableProps) {
  if (executions.length === 0) {
    return <ExecutionsEmptyState action={emptyAction} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead>Finalizada</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => {
            const href = getExecutionHref(processType, execution.id);

            return (
              <TableRow id={`ejecucion-${execution.id}`} key={execution.id}>
                <TableCell className="font-medium">#{execution.id}</TableCell>
                <TableCell>
                  <StatusBadge status={execution.estado} />
                </TableCell>
                <TableCell>{formatDateTime(execution.created_at)}</TableCell>
                <TableCell>{formatDateTime(execution.finished_at)}</TableCell>
                <TableCell>
                  <ExecutionResult
                    execution={execution}
                    processType={processType}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {href ? (
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                      {processType === "TRANSFORMACION_EXCEL" ? (
                        <TransformationExecutionActions
                          executionId={execution.id}
                          fallbackFilename={
                            getTransformationGeneration(execution)?.nombre_archivo
                          }
                        />
                      ) : null}
                      <Button asChild size="sm" variant="outline">
                        <Link
                          aria-label={`Abrir ejecución ${execution.id}`}
                          href={href}
                        >
                          Abrir
                          <ExternalLink aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin vista disponible
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
