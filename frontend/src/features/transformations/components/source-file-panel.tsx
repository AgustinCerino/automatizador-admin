"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileSpreadsheet, Upload, TriangleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorState } from "@/components/feedback/error-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useTransformationSourceFilesQuery,
  useTransformationSourceStructureQuery,
  useUploadTransformationSourceFile,
} from "@/features/transformations/api/use-source-files";
import {
  createTransformationSourceDraftHref,
  readTransformationSourceDraft,
  resolveTransformationSourceDraft,
  type TransformationSourceDraft,
} from "@/features/transformations/source-draft";
import type {
  TransformationSourceFile,
  TransformationSourceStructure,
  TransformationSummary,
} from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format-date";
import { formatFileSize, formatNumber } from "@/lib/format-values";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/lib/utils";

const ACCEPTED_FILE_PATTERN = /\.(csv|xls|xlsx)$/i;

const uploadSchema = z.object({
  file: z
    .custom<File>(
      (value) => typeof File !== "undefined" && value instanceof File,
      "Seleccioná un archivo.",
    )
    .refine((file) => ACCEPTED_FILE_PATTERN.test(file.name), {
      message: "El archivo debe ser CSV, XLS o XLSX.",
    }),
});

const inspectionSchema = z.object({
  headerRow: z.number().int().positive("Ingresá una fila válida."),
  sheet: z.string().nullable(),
  sourceFileId: z.number().int().positive(),
});

type UploadValues = z.infer<typeof uploadSchema>;
type InspectionValues = z.infer<typeof inspectionSchema>;

const TYPE_LABELS: Record<string, string> = {
  boolean: "Booleano",
  date: "Fecha",
  decimal: "Decimal",
  integer: "Entero",
  text: "Texto",
  unknown: "Desconocido",
};

function errorDescription(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos completar la operación.";
  const byStatus: Partial<Record<number, string>> = {
    400: "Revisá el archivo, la hoja y la fila de encabezado.",
    401: "Tu sesión venció.",
    403: "No tenés permisos para usar este archivo.",
    404: "No se encontró el archivo fuente seleccionado.",
    413: "El archivo supera el tamaño permitido por el servidor.",
    422: "El archivo o los parámetros de inspección no son válidos.",
    500: "El servidor no pudo procesar la respuesta.",
    503: "El servidor no está disponible.",
  };
  return byStatus[error.status] ?? "No pudimos completar la operación.";
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Dato complejo";
  }
}

function SourceFileDetails({ file }: { file: TransformationSourceFile }) {
  return (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Archivo</dt>
        <dd className="mt-1 break-words font-medium">{file.nombre_original}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Tamaño</dt>
        <dd className="mt-1">{formatFileSize(file.size_bytes)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Cargado</dt>
        <dd className="mt-1">{formatDateTime(file.uploaded_at)}</dd>
      </div>
    </dl>
  );
}

function StructurePreview({ structure }: { structure: TransformationSourceStructure }) {
  const columns = structure.columns.map((column) => column.name);

  return (
    <div className="space-y-5">
      {structure.warnings?.length ? (
        <div className="space-y-2" aria-label="Advertencias de inspección">
          {structure.warnings.map((warning, index) => (
            <Alert className="border-warning/40 bg-warning/10" key={`${warning.code}-${index}`}>
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{warning.message}</AlertTitle>
              <AlertDescription>
                {warning.columns?.length
                  ? `Columnas: ${warning.columns.join(", ")}`
                  : warning.code}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <div>
        <h3 className="font-semibold">Columnas detectadas</h3>
        <Table>
          <TableCaption>
            {formatNumber(structure.columns.length)} columnas en la fila {formatNumber(structure.header_row)}.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Columna</TableHead>
              <TableHead>Tipo detectado</TableHead>
              <TableHead className="text-right">Valores vacíos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {structure.columns.map((column) => (
              <TableRow key={column.name}>
                <TableCell className="font-medium">{column.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{TYPE_LABELS[column.detected_type]}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatNumber(column.null_count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-semibold">Vista previa</h3>
        {structure.rows.length ? (
          <Table>
            <TableCaption>
              Primeras {formatNumber(structure.rows.length)} de {formatNumber(structure.total_rows)} filas.
            </TableCaption>
            <TableHeader>
              <TableRow>
                {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {structure.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell className="max-w-72 truncate" key={column} title={formatPreviewValue(row[column])}>
                      {formatPreviewValue(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No hay filas para mostrar.</p>
        )}
      </div>
    </div>
  );
}

export function SourceFilePanel({ summary }: { summary: TransformationSummary }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const resolvedDefaultSheetKey = useRef<string | null>(null);
  const draft = useMemo(() => readTransformationSourceDraft(searchParams), [searchParams]);
  const effective = resolveTransformationSourceDraft(summary, draft);
  const isConfigured = summary.has_configuration && summary.source !== null;
  const filesQuery = useTransformationSourceFilesQuery(summary.ejecucion_id);
  const uploadMutation = useUploadTransformationSourceFile(summary.ejecucion_id);

  const replaceDraft = useCallback(
    (nextDraft: TransformationSourceDraft) => {
      router.replace(
        createTransformationSourceDraftHref(pathname, searchParams, nextDraft),
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );

  const configuredFile = summary.source
    ? {
        ejecucion_id: summary.ejecucion_id,
        extension: summary.source.extension,
        id: summary.source.archivo_id,
        mime_type: null,
        nombre_original: summary.source.nombre_original,
        size_bytes: null,
        tipo_archivo: "FUENTE",
        uploaded_at: "",
      } satisfies TransformationSourceFile
    : null;
  const selectedFile =
    filesQuery.data?.find((file) => file.id === effective.sourceFileId) ?? configuredFile;
  const selectedIsCsv = selectedFile?.extension?.toLowerCase() === ".csv";
  const canInspect = !isConfigured || summary.source?.file_exists === true;

  const structureQuery = useTransformationSourceStructureQuery({
    executionId: summary.ejecucion_id,
    fileId: canInspect ? effective.sourceFileId : null,
    headerRow: effective.headerRow,
    sheet: selectedIsCsv ? null : effective.sheet,
  });

  useEffect(() => {
    if (isConfigured || !structureQuery.data || effective.sheet !== null || selectedIsCsv) return;
    const selectedSheet = structureQuery.data.selected_sheet_name;
    if (selectedSheet === null) return;
    const resolutionKey = `${effective.sourceFileId}:${effective.headerRow}:${selectedSheet}`;
    if (resolvedDefaultSheetKey.current === resolutionKey) return;
    resolvedDefaultSheetKey.current = resolutionKey;

    queryClient.setQueryData(
      queryKeys.transformations.sourceStructure(
        summary.ejecucion_id,
        effective.sourceFileId ?? 0,
        selectedSheet,
        effective.headerRow,
      ),
      structureQuery.data,
    );
    replaceDraft({ ...effective, sheet: selectedSheet });
  }, [effective, isConfigured, queryClient, replaceDraft, selectedIsCsv, structureQuery.data, summary.ejecucion_id]);

  useEffect(() => {
    if (!isConfigured && selectedIsCsv && effective.sheet !== null) {
      replaceDraft({ ...effective, sheet: null });
    }
  }, [effective, isConfigured, replaceDraft, selectedIsCsv]);

  const uploadForm = useForm<UploadValues>({ resolver: zodResolver(uploadSchema) });
  const inspectionForm = useForm<InspectionValues>({
    defaultValues: {
      headerRow: effective.headerRow,
      sheet: effective.sheet,
      sourceFileId: effective.sourceFileId ?? undefined,
    },
    resolver: zodResolver(inspectionSchema),
  });

  useEffect(() => {
    inspectionForm.reset({
      headerRow: effective.headerRow,
      sheet: structureQuery.data?.selected_sheet_name ?? effective.sheet,
      sourceFileId: effective.sourceFileId ?? undefined,
    });
  }, [effective.headerRow, effective.sheet, effective.sourceFileId, inspectionForm, structureQuery.data?.selected_sheet_name]);

  const submitUpload = uploadForm.handleSubmit(async ({ file }) => {
    try {
      const uploaded = await uploadMutation.mutateAsync(file);
      uploadForm.reset();
      replaceDraft({ headerRow: 1, sheet: null, sourceFileId: uploaded.id });
    } catch {
      // Mutation state renders the controlled error.
    }
  });

  const submitInspection = inspectionForm.handleSubmit((values) => {
    replaceDraft({
      headerRow: values.headerRow,
      sheet: selectedIsCsv ? null : values.sheet,
      sourceFileId: values.sourceFileId,
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Archivo fuente</h2></CardTitle>
        <CardDescription>
          Cargá o seleccioná un CSV o Excel y revisá su estructura antes de configurar la transformación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConfigured ? (
          <Alert>
            <FileSpreadsheet aria-hidden="true" />
            <AlertTitle>Fuente definida por la configuración guardada</AlertTitle>
            <AlertDescription>
              El archivo, la hoja y la fila se muestran en modo de solo lectura.
            </AlertDescription>
          </Alert>
        ) : (
          <form className="space-y-3" onSubmit={submitUpload}>
            <Label htmlFor="source-file">Cargar un archivo nuevo</Label>
            <Controller
              control={uploadForm.control}
              name="file"
              render={({ field: { onChange, ref } }) => (
                <label
                  className={cn(
                    "flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition-colors hover:bg-muted/50",
                    uploadForm.formState.errors.file && "border-destructive",
                  )}
                  htmlFor="source-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onChange(event.dataTransfer.files.item(0) ?? undefined);
                  }}
                >
                  <Upload aria-hidden="true" className="mb-2 size-5 text-muted-foreground" />
                  <span className="font-medium">Elegí o arrastrá un archivo</span>
                  <span className="mt-1 text-xs text-muted-foreground">CSV, XLS o XLSX</span>
                  <Input
                    accept=".csv,.xls,.xlsx"
                    className="sr-only"
                    id="source-file"
                    onChange={(event) => onChange(event.target.files?.item(0) ?? undefined)}
                    ref={ref}
                    type="file"
                  />
                </label>
              )}
            />
            {uploadForm.formState.errors.file ? (
              <p className="text-sm text-destructive" role="alert">
                {uploadForm.formState.errors.file.message}
              </p>
            ) : null}
            <Button disabled={uploadMutation.isPending} type="submit">
              <Upload aria-hidden="true" />
              {uploadMutation.isPending ? "Cargando…" : "Cargar archivo"}
            </Button>
            {uploadMutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {errorDescription(uploadMutation.error)}
              </p>
            ) : null}
            {uploadMutation.isSuccess ? (
              <p className="text-sm text-success-foreground" role="status">
                Archivo cargado y seleccionado.
              </p>
            ) : null}
          </form>
        )}

        {!isConfigured ? (
          <div className="space-y-2">
            <Label htmlFor="source-file-select">Archivo fuente</Label>
            {filesQuery.isPending ? <Skeleton className="h-8 w-full" /> : null}
            {filesQuery.isError ? (
              <ErrorState
                className="py-6"
                description={errorDescription(filesQuery.error)}
                retry={() => void filesQuery.refetch()}
                title="No pudimos listar los archivos"
              />
            ) : null}
            {filesQuery.data ? (
              filesQuery.data.length ? (
                <Select
                  onValueChange={(value) => {
                    const sourceFileId = Number(value);
                    inspectionForm.setValue("sourceFileId", sourceFileId);
                    inspectionForm.setValue("sheet", null);
                    inspectionForm.setValue("headerRow", 1);
                    replaceDraft({ headerRow: 1, sheet: null, sourceFileId });
                  }}
                  value={effective.sourceFileId ? String(effective.sourceFileId) : undefined}
                >
                  <SelectTrigger className="w-full" id="source-file-select">
                    <SelectValue placeholder="Seleccioná un archivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {filesQuery.data.map((file) => (
                      <SelectItem key={file.id} value={String(file.id)}>
                        {file.nombre_original}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay archivos fuente cargados.</p>
              )
            ) : null}
          </div>
        ) : null}

        {selectedFile && selectedFile.uploaded_at ? <SourceFileDetails file={selectedFile} /> : null}
        {isConfigured && summary.source ? (
          <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Archivo</dt>
              <dd className="mt-1 break-words font-medium">{summary.source.nombre_original}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Extensión</dt>
              <dd className="mt-1">{summary.source.extension ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Hoja</dt>
              <dd className="mt-1">{summary.source.sheet_name ?? "No aplica"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fila de encabezado</dt>
              <dd className="mt-1">{formatNumber(summary.source.header_row)}</dd>
            </div>
          </dl>
        ) : null}
        {isConfigured && summary.source && !summary.source.file_exists ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Archivo no disponible</AlertTitle>
            <AlertDescription>El archivo fuente configurado ya no está disponible.</AlertDescription>
          </Alert>
        ) : null}

        {effective.sourceFileId && canInspect ? (
          <form className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end" onSubmit={submitInspection}>
            <div className="space-y-2">
              <Label htmlFor="source-sheet">Hoja</Label>
              {selectedIsCsv ? (
                <Input disabled id="source-sheet" value="No aplica para CSV" />
              ) : (
                <Controller
                  control={inspectionForm.control}
                  name="sheet"
                  render={({ field }) => (
                    <Select
                      disabled={isConfigured || !structureQuery.data?.available_sheets.length}
                      onValueChange={field.onChange}
                      value={field.value ?? structureQuery.data?.selected_sheet_name ?? undefined}
                    >
                      <SelectTrigger className="w-full" id="source-sheet">
                        <SelectValue placeholder="Detectando hojas…" />
                      </SelectTrigger>
                      <SelectContent>
                        {structureQuery.data?.available_sheets.map((sheet) => (
                          <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-header-row">Fila de encabezado</Label>
              <Input
                disabled={isConfigured}
                id="source-header-row"
                min={1}
                type="number"
                {...inspectionForm.register("headerRow", { valueAsNumber: true })}
              />
              {inspectionForm.formState.errors.headerRow ? (
                <p className="text-xs text-destructive" role="alert">
                  {inspectionForm.formState.errors.headerRow.message}
                </p>
              ) : null}
            </div>
            <Button disabled={isConfigured || structureQuery.isFetching} type="submit">
              {structureQuery.isFetching ? "Inspeccionando…" : "Inspeccionar"}
            </Button>
          </form>
        ) : null}

        {structureQuery.isPending && effective.sourceFileId && canInspect ? (
          <div aria-label="Inspeccionando archivo" className="space-y-3" role="status">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}
        {structureQuery.isError ? (
          <ErrorState
            className="py-6"
            description={errorDescription(structureQuery.error)}
            retry={() => void structureQuery.refetch()}
            title="No pudimos inspeccionar el archivo"
          />
        ) : null}
        {structureQuery.data ? <StructurePreview structure={structureQuery.data} /> : null}
      </CardContent>
    </Card>
  );
}
