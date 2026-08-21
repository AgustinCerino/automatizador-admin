"use client";

import { AlertCircle, Save } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useConciliationFilesQuery,
  useConciliationMappingQuery,
  useConciliationPreviewQuery,
  useConciliationSelectionQuery,
  useSaveConciliationMapping,
  useSaveConciliationSelection,
} from "@/features/conciliations/api/use-conciliation-files";
import { ConciliationMappingEditor } from "@/features/conciliations/components/conciliation-mapping-editor";
import { ConciliationFileSlot } from "@/features/conciliations/components/conciliation-file-slot";
import type { ExecutionRead } from "@/features/executions/types";
import { useExecutionQuery } from "@/features/executions/api/use-execution-query";
import { useProcessQuery } from "@/features/processes/api/use-process-query";
import type { ProcessRead } from "@/features/processes/types";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format-date";

interface DraftOverrides {
  archivoAId?: number | null;
  archivoBId?: number | null;
}

function errorDescription(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages: Partial<Record<number, string>> = {
    400: "Esta ejecución no corresponde a una conciliación Excel.",
    403: "No tenés permisos para acceder a esta ejecución.",
    404: "No se encontró la ejecución o uno de sus archivos.",
    503: "El servidor no está disponible.",
  };
  return messages[error.status] ?? fallback;
}

function WorkspaceSkeleton() {
  return (
    <div aria-label="Cargando conciliación" className="space-y-6" role="status">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

function ConciliationWorkspaceContent({
  execution,
  process,
}: {
  execution: ExecutionRead;
  process: ProcessRead;
}) {
  const filesQuery = useConciliationFilesQuery(execution.id);
  const selectionQuery = useConciliationSelectionQuery(execution.id);
  const saveMutation = useSaveConciliationSelection(execution.id);
  const mappingQuery = useConciliationMappingQuery(execution.id);
  const saveMappingMutation = useSaveConciliationMapping(execution.id);
  const [draftOverrides, setDraftOverrides] = useState<DraftOverrides>({});

  const persistedAId = selectionQuery.data?.archivo_a_id ?? null;
  const persistedBId = selectionQuery.data?.archivo_b_id ?? null;
  const draftAId = Object.hasOwn(draftOverrides, "archivoAId")
    ? (draftOverrides.archivoAId ?? null)
    : persistedAId;
  const draftBId = Object.hasOwn(draftOverrides, "archivoBId")
    ? (draftOverrides.archivoBId ?? null)
    : persistedBId;

  const isDirty =
    draftAId !== persistedAId || draftBId !== persistedBId;
  const sameFile =
    draftAId !== null && draftAId === draftBId;
  const canSave =
    isDirty &&
    draftAId !== null &&
    draftBId !== null &&
    !sameFile &&
    !saveMutation.isPending;
  const previewAQuery = useConciliationPreviewQuery(execution.id, persistedAId);
  const previewBQuery = useConciliationPreviewQuery(execution.id, persistedBId);

  async function saveSelection() {
    if (!canSave || draftAId === null || draftBId === null) return;
    try {
      await saveMutation.mutateAsync({
        archivo_a_id: draftAId,
        archivo_b_id: draftBId,
      });
      setDraftOverrides({});
    } catch {
      // La mutación expone el error controlado.
    }
  }

  const executionsHref = `/procesos/${process.id}/ejecuciones`;

  return (
    <div className="space-y-6">
      <PageHeader
        action={<StatusBadge status={execution.estado} />}
        breadcrumbs={[
          { label: "Procesos", href: "/procesos" },
          { label: process.nombre, href: executionsHref },
          { label: "Ejecuciones", href: executionsHref },
          { label: `Ejecución #${execution.id}` },
        ]}
        description={`Ejecución #${execution.id} · ${process.nombre}`}
        title="Conciliación Excel"
      />

      {filesQuery.isPending || selectionQuery.isPending ? <WorkspaceSkeleton /> : null}

      {filesQuery.isError ? (
        <ErrorState
          description={errorDescription(filesQuery.error, "No pudimos listar los archivos de la ejecución.")}
          retry={() => void filesQuery.refetch()}
          title="No pudimos cargar los archivos"
        />
      ) : null}
      {selectionQuery.isError ? (
        <ErrorState
          description={errorDescription(selectionQuery.error, "No pudimos recuperar la selección A/B.")}
          retry={() => void selectionQuery.refetch()}
          title="No pudimos cargar la selección"
        />
      ) : null}

      {filesQuery.data && selectionQuery.isSuccess ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle><h2>Archivos disponibles</h2></CardTitle>
              <CardDescription>
                Los roles A/B se definen mediante la selección guardada, no por el orden de carga.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filesQuery.data.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Todavía no hay archivos CSV o Excel asociados a esta ejecución.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Extensión</TableHead>
                      <TableHead>Cargado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filesQuery.data.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.nombre_original}</TableCell>
                        <TableCell>{file.extension?.toUpperCase() ?? "—"}</TableCell>
                        <TableCell>{formatDateTime(file.uploaded_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ConciliationFileSlot
              executionId={execution.id}
              files={filesQuery.data}
              onSelect={(archivoAId) => setDraftOverrides((current) => ({ ...current, archivoAId }))}
              otherSelectedId={draftBId}
              role="A"
              selectedId={draftAId}
            />
            <ConciliationFileSlot
              executionId={execution.id}
              files={filesQuery.data}
              onSelect={(archivoBId) => setDraftOverrides((current) => ({ ...current, archivoBId }))}
              otherSelectedId={draftAId}
              role="B"
              selectedId={draftBId}
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {isDirty ? "Cambios sin guardar" : "Selección sincronizada"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isDirty
                    ? "Los previews reflejan el borrador actual. Guardá para persistir A/B."
                    : selectionQuery.data
                      ? "Archivo A y Archivo B coinciden con el estado persistido."
                      : "Seleccioná dos archivos diferentes para guardar A/B."}
                </p>
              </div>
              <Button disabled={!canSave} onClick={() => void saveSelection()} type="button">
                <Save aria-hidden="true" />
                {saveMutation.isPending ? "Guardando…" : "Guardar selección"}
              </Button>
            </CardContent>
          </Card>

          {sameFile ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Selección inválida</AlertTitle>
              <AlertDescription>Archivo A y Archivo B deben ser distintos.</AlertDescription>
            </Alert>
          ) : null}
          {saveMutation.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>No pudimos guardar la selección</AlertTitle>
              <AlertDescription>
                {errorDescription(saveMutation.error, "Revisá A/B e intentá nuevamente.")}
              </AlertDescription>
            </Alert>
          ) : null}
          {saveMutation.isSuccess && !isDirty ? (
            <p className="text-sm text-success-foreground" role="status">
              Selección A/B guardada correctamente.
            </p>
          ) : null}

          <ConciliationMappingEditor
            archivoAId={persistedAId}
            archivoBId={persistedBId}
            columnsA={previewAQuery.data?.columns ?? null}
            columnsB={previewBQuery.data?.columns ?? null}
            columnsError={previewAQuery.error ?? previewBQuery.error}
            mapping={mappingQuery.data ?? null}
            mappingError={mappingQuery.error}
            mappingLoading={mappingQuery.isPending}
            mappingSelectionDirty={isDirty}
            onRetry={() => void mappingQuery.refetch()}
            onRetryColumns={() => {
              void previewAQuery.refetch();
              void previewBQuery.refetch();
            }}
            onSave={saveMappingMutation.mutateAsync}
            saveError={saveMappingMutation.error}
            saving={saveMappingMutation.isPending}
          />
        </>
      ) : null}
    </div>
  );
}

export function ConciliationWorkspace({ executionId }: { executionId: number }) {
  const executionQuery = useExecutionQuery(executionId);
  const processQuery = useProcessQuery(executionQuery.data?.proceso_id ?? 0);

  if (executionQuery.isPending || (executionQuery.data && processQuery.isPending)) {
    return <WorkspaceSkeleton />;
  }

  if (executionQuery.isError || !executionQuery.data) {
    return (
      <ErrorState
        description={errorDescription(executionQuery.error, "No pudimos cargar la ejecución.")}
        retry={() => void executionQuery.refetch()}
        title="No pudimos cargar la conciliación"
      />
    );
  }

  if (processQuery.isError || !processQuery.data) {
    return (
      <ErrorState
        description={errorDescription(processQuery.error, "No pudimos cargar el proceso.")}
        retry={() => void processQuery.refetch()}
        title="No pudimos validar el proceso"
      />
    );
  }

  if (processQuery.data.tipo !== "CONCILIACION_EXCEL") {
    return (
      <ErrorState
        description="Esta ejecución no corresponde a una conciliación Excel."
        title="Workspace no disponible"
      />
    );
  }

  return (
    <ConciliationWorkspaceContent
      execution={executionQuery.data}
      process={processQuery.data}
    />
  );
}
