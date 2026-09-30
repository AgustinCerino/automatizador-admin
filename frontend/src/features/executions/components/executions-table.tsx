"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type DateOrder = "newest" | "oldest";

const SELECT_CLASS_NAME =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto";

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateOrder, setDateOrder] = useState<DateOrder>("newest");

  const isTransformationHistory = processType === "TRANSFORMACION_EXCEL";
  const statuses = useMemo(
    () => [...new Set(executions.map((execution) => execution.estado))].sort(),
    [executions],
  );
  const visibleExecutions = useMemo(() => {
    if (!isTransformationHistory) {
      return executions;
    }

    const normalizedSearch = search.trim().toLocaleLowerCase("es-AR");
    return [...executions]
      .filter((execution) => {
        if (status !== "ALL" && execution.estado !== status) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const generation = getTransformationGeneration(execution);
        const searchableText = [
          String(execution.id),
          `#${execution.id}`,
          generation?.nombre_archivo,
          execution.error_message,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .toLocaleLowerCase("es-AR");

        return searchableText.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const difference =
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime();
        return dateOrder === "newest" ? difference : -difference;
      });
  }, [dateOrder, executions, isTransformationHistory, search, status]);

  if (executions.length === 0) {
    return <ExecutionsEmptyState action={emptyAction} />;
  }

  const hasActiveFilters = search !== "" || status !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setDateOrder("newest");
  }

  return (
    <div className="space-y-4">
      {isTransformationHistory ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="execution-search">Buscar</Label>
              <Input
                id="execution-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ID, archivo o error"
                type="search"
                value={search}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-status">Estado</Label>
              <select
                className={SELECT_CLASS_NAME}
                id="execution-status"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="ALL">Todos</option>
                {statuses.map((executionStatus) => (
                  <option key={executionStatus} value={executionStatus}>
                    {executionStatus}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-order">Orden</Label>
              <select
                className={SELECT_CLASS_NAME}
                id="execution-order"
                onChange={(event) =>
                  setDateOrder(event.target.value as DateOrder)
                }
                value={dateOrder}
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguas</option>
              </select>
            </div>
            <Button
              disabled={!hasActiveFilters && dateOrder === "newest"}
              onClick={clearFilters}
              type="button"
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {visibleExecutions.length}{" "}
            {visibleExecutions.length === 1
              ? "resultado visible"
              : "resultados visibles"}
          </p>
        </div>
      ) : null}

      {visibleExecutions.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={clearFilters} type="button" variant="outline">
              Limpiar filtros
            </Button>
          }
          description="Probá con otra búsqueda o cambiá el estado seleccionado."
          title="No hay ejecuciones que coincidan."
        />
      ) : (
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
          {visibleExecutions.map((execution) => {
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
      )}
    </div>
  );
}
