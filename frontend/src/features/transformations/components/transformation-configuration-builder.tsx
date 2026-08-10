"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSaveTransformationConfiguration,
  useTransformationConfigurationQuery,
} from "@/features/transformations/api/use-configuration";
import { useTransformationSourceStructureQuery } from "@/features/transformations/api/use-source-files";
import {
  readTransformationSourceDraft,
  resolveTransformationSourceDraft,
} from "@/features/transformations/source-draft";
import type {
  TransformationExcelConfig,
  TransformationSummary,
} from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";

type Operation = "SOURCE" | "CONSTANT";

interface DraftColumn {
  id: number;
  operation: Operation;
  outputColumn: string;
  sourceColumn: string;
  value: string;
}

function isBasicConfiguration(configuration: TransformationExcelConfig): boolean {
  return configuration.output_columns.every(
    (column) => column.operation === "SOURCE" || column.operation === "CONSTANT",
  );
}

function draftColumnsFromConfiguration(configuration: TransformationExcelConfig): DraftColumn[] {
  return configuration.output_columns.map((column, index) => ({
    id: index + 1,
    operation: column.operation as Operation,
    outputColumn: column.output_column,
    sourceColumn: column.operation === "SOURCE" ? column.source_column : "",
    value: column.operation === "CONSTANT" && column.value !== null ? String(column.value) : "",
  }));
}

function emptyColumn(id: number): DraftColumn {
  return { id, operation: "SOURCE", outputColumn: "", sourceColumn: "", value: "" };
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos guardar la configuraci\u00f3n.";
  if (error.status === 409) return "La configuraci\u00f3n no puede editarse en el estado actual.";
  if (error.status === 422) return "Revis\u00e1 los datos de las columnas antes de guardar.";
  if (error.status === 503) return "El servidor no est\u00e1 disponible.";
  return "No pudimos guardar la configuraci\u00f3n.";
}

export function TransformationConfigurationBuilder({ summary }: { summary: TransformationSummary }) {
  const searchParams = useSearchParams();
  const sourceDraft = useMemo(
    () => {
      const sourceParams = searchParams ?? new URLSearchParams();
      return resolveTransformationSourceDraft(summary, readTransformationSourceDraft(sourceParams));
    },
    [searchParams, summary],
  );
  const configurationQuery = useTransformationConfigurationQuery(
    summary.ejecucion_id,
    summary.has_configuration,
  );
  const persistedConfiguration = configurationQuery.data?.configuracion;
  const hasAdvancedConfiguration = persistedConfiguration
    ? !isBasicConfiguration(persistedConfiguration)
    : false;
  const structureQuery = useTransformationSourceStructureQuery({
    executionId: summary.ejecucion_id,
    fileId: sourceDraft.sourceFileId,
    headerRow: sourceDraft.headerRow,
    sheet: sourceDraft.sheet,
  });
  const saveMutation = useSaveTransformationConfiguration(summary.ejecucion_id);
  const [columns, setColumns] = useState<DraftColumn[]>(() => [emptyColumn(1)]);
  const [nextId, setNextId] = useState(2);
  const initializedConfiguration = useRef<TransformationExcelConfig | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!persistedConfiguration || !isBasicConfiguration(persistedConfiguration)) {
      return;
    }
    if (initializedConfiguration.current === persistedConfiguration) return;
    initializedConfiguration.current = persistedConfiguration;
    const initialColumns = draftColumnsFromConfiguration(persistedConfiguration);
    queueMicrotask(() => {
      setColumns(initialColumns);
      setNextId(initialColumns.length + 1);
    });
  }, [persistedConfiguration]);

  const sourceColumns = structureQuery.data?.columns.map((column) => column.name) ?? [];
  const canEdit =
    summary.can_edit_configuration &&
    !hasAdvancedConfiguration &&
    (!summary.has_configuration || configurationQuery.isSuccess);

  function updateColumn(id: number, update: Partial<DraftColumn>) {
    setColumns((current) => current.map((column) => column.id === id ? { ...column, ...update } : column));
    setValidationMessage(null);
  }

  function changeOperation(id: number, operation: Operation) {
    updateColumn(id, { operation, sourceColumn: "", value: "" });
  }

  async function save() {
    if (!sourceDraft.sourceFileId) {
      setValidationMessage("Seleccion\u00e1 un archivo fuente antes de guardar.");
      return;
    }
    if (!columns.length) {
      setValidationMessage("Agreg\u00e1 al menos una columna de salida.");
      return;
    }
    const invalidColumn = columns.find(
      (column) =>
        !column.outputColumn.trim() ||
        (column.operation === "SOURCE" && !column.sourceColumn) ||
        (column.operation === "CONSTANT" && column.value.trim() === ""),
    );
    if (invalidColumn) {
      setValidationMessage("Complet\u00e1 el nombre y la configuraci\u00f3n de cada columna.");
      return;
    }

    const source = persistedConfiguration?.source ?? {
      archivo_id: sourceDraft.sourceFileId,
      header_row: sourceDraft.headerRow,
      sheet_name: sourceDraft.sheet,
    };
    const configuration: TransformationExcelConfig = {
      ...(persistedConfiguration?.output ? { output: persistedConfiguration.output } : {}),
      output_columns: columns.map((column, index) =>
        column.operation === "SOURCE"
          ? {
              operation: "SOURCE" as const,
              output_column: column.outputColumn.trim(),
              output_type: "text" as const,
              position: index + 1,
              required: false,
              source_column: column.sourceColumn,
            }
          : {
              operation: "CONSTANT" as const,
              output_column: column.outputColumn.trim(),
              output_type: "text" as const,
              position: index + 1,
              required: false,
              value: column.value,
            },
      ),
      ...(persistedConfiguration?.rows ? { rows: persistedConfiguration.rows } : {}),
      source,
    };
    setValidationMessage(null);
    try {
      await saveMutation.mutateAsync(configuration);
    } catch {
      // The mutation error is rendered below.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Columnas de salida</h2></CardTitle>
        <CardDescription>
          Definí las columnas del archivo resultante a partir de la fuente inspeccionada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {configurationQuery.isPending && summary.has_configuration ? (
          <p className="text-sm text-muted-foreground">Cargando configuración guardada…</p>
        ) : null}
        {configurationQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>No pudimos cargar la configuración</AlertTitle>
            <AlertDescription>La configuración existente no se modificará desde esta pantalla.</AlertDescription>
          </Alert>
        ) : null}
        {hasAdvancedConfiguration ? (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Configuración avanzada detectada</AlertTitle>
            <AlertDescription>
              Esta ejecución usa operaciones que el constructor básico todavía no admite. Se conserva sin cambios para evitar sobrescribirla.
            </AlertDescription>
          </Alert>
        ) : null}
        {!sourceDraft.sourceFileId ? (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Falta un archivo fuente</AlertTitle>
            <AlertDescription>Seleccioná e inspeccioná un archivo antes de configurar las columnas.</AlertDescription>
          </Alert>
        ) : null}
        {sourceDraft.sourceFileId && structureQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Cargando columnas inspeccionadas…</p>
        ) : null}
        {sourceDraft.sourceFileId && !structureQuery.isPending && !sourceColumns.length ? (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>No hay columnas inspeccionadas</AlertTitle>
            <AlertDescription>Revisá la hoja y la fila de encabezado del archivo fuente.</AlertDescription>
          </Alert>
        ) : null}

        {!hasAdvancedConfiguration ? (
          <div className="space-y-4">
            {columns.map((column, index) => (
              <fieldset className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)_auto] md:items-end" key={column.id}>
                <legend className="px-1 text-sm font-medium">Columna {index + 1}</legend>
                <div className="space-y-2">
                  <Label htmlFor={`output-${column.id}`}>Nombre de salida</Label>
                  <Input disabled={!canEdit} id={`output-${column.id}`} onChange={(event) => updateColumn(column.id, { outputColumn: event.target.value })} value={column.outputColumn} />
                </div>
                <div className="space-y-2">
                  <Label>Operación</Label>
                  <Select disabled={!canEdit} onValueChange={(value) => changeOperation(column.id, value as Operation)} value={column.operation}>
                    <SelectTrigger aria-label={`Operaci\u00f3n de columna ${index + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="SOURCE">SOURCE</SelectItem><SelectItem value="CONSTANT">CONSTANT</SelectItem></SelectContent>
                  </Select>
                </div>
                <Button aria-label={`Eliminar columna ${index + 1}`} disabled={!canEdit} onClick={() => setColumns((current) => current.filter((item) => item.id !== column.id))} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor={`value-${column.id}`}>{column.operation === "SOURCE" ? "Columna de origen" : "Valor constante"}</Label>
                  {column.operation === "SOURCE" ? (
                    <Select disabled={!canEdit || !sourceColumns.length} onValueChange={(value) => updateColumn(column.id, { sourceColumn: value })} value={column.sourceColumn || undefined}>
                      <SelectTrigger id={`value-${column.id}`}><SelectValue placeholder="Seleccioná una columna inspeccionada" /></SelectTrigger>
                      <SelectContent>{sourceColumns.map((sourceColumn) => <SelectItem key={sourceColumn} value={sourceColumn}>{sourceColumn}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <Input disabled={!canEdit} id={`value-${column.id}`} onChange={(event) => updateColumn(column.id, { value: event.target.value })} value={column.value} />}
                </div>
              </fieldset>
            ))}
            {validationMessage ? <p className="text-sm text-destructive" role="alert">{validationMessage}</p> : null}
            {saveMutation.isError ? <p className="text-sm text-destructive" role="alert">{getErrorMessage(saveMutation.error)}</p> : null}
            {saveMutation.isSuccess ? <p className="text-sm text-success-foreground" role="status">Configuración guardada.</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={!canEdit} onClick={() => { setColumns((current) => [...current, emptyColumn(nextId)]); setNextId((current) => current + 1); }} type="button" variant="outline"><Plus aria-hidden="true" />Agregar columna</Button>
              <Button disabled={!canEdit || saveMutation.isPending || !sourceColumns.length} onClick={() => void save()} type="button"><Save aria-hidden="true" />{saveMutation.isPending ? "Guardando\u2026" : "Guardar configuraci\u00f3n"}</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
