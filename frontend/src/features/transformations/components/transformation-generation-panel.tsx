"use client";

import { AlertCircle, CheckCircle2, Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGenerateTransformationResult,
  useTransformationResultQuery,
} from "@/features/transformations/api/use-configuration";
import type { TransformationGenerationRead, TransformationSummary } from "@/features/transformations/types";
import { ApiError, createApiError } from "@/lib/api/errors";

interface Props {
  isDirty: boolean;
  summary: TransformationSummary;
  validationIsValid: boolean;
}

function filenameFromDisposition(value: string | null, fallback: string): string {
  const match = value?.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
  if (!match) return fallback;
  try { return decodeURIComponent(match[1].trim()); } catch { return fallback; }
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "No pudimos comunicarnos con el servidor.";
}

async function downloadResult(executionId: number, fallbackFilename: string): Promise<void> {
  const response = await fetch(`/api/backend/transformaciones/${executionId}/resultado/descargar`, {
    credentials: "same-origin",
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
  if (!response.ok) throw await createApiError(response);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("spreadsheetml.sheet")) {
    throw new ApiError(response.status, { message: "La descarga no devolvió un archivo XLSX válido." });
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromDisposition(response.headers.get("content-disposition"), fallbackFilename);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ResultDetails({ result }: { result: TransformationGenerationRead }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">
    <div><dt className="text-muted-foreground">Archivo</dt><dd className="font-medium">{result.nombre_archivo}</dd></div>
    <div><dt className="text-muted-foreground">Filas</dt><dd className="font-medium">{result.total_filas}</dd></div>
  </dl>;
}

export function TransformationGenerationPanel({ isDirty, summary, validationIsValid }: Props) {
  const resultQuery = useTransformationResultQuery(summary.ejecucion_id, summary.generation.available && !isDirty);
  const generateMutation = useGenerateTransformationResult(summary.ejecucion_id);
  const result = generateMutation.data ?? resultQuery.data;
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const stale = isDirty && (Boolean(result) || summary.generation.available);
  const canGenerate = !isDirty && summary.can_generate && (
    validationIsValid || summary.estado_ejecucion === "VALIDADO"
  );

  async function download() {
    if (!result || isDownloading) return;
    setDownloadError(null);
    setIsDownloading(true);
    try { await downloadResult(summary.ejecucion_id, result.nombre_archivo); }
    catch (error) { setDownloadError(errorMessage(error)); }
    finally { setIsDownloading(false); }
  }

  return <Card>
    <CardHeader><CardTitle><h2>Generar archivo</h2></CardTitle><CardDescription>Generá el XLSX definitivo sólo después de validar la configuración guardada.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {isDirty ? <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Resultado desactualizado</AlertTitle><AlertDescription>Guardá y validá nuevamente para generar un archivo que corresponda al borrador actual.</AlertDescription></Alert> : null}
      {!isDirty && !canGenerate && !result ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Falta una validación vigente</AlertTitle><AlertDescription>Guardá la configuración y ejecutá la validación antes de generar.</AlertDescription></Alert> : null}
      {generateMutation.isError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos generar el archivo</AlertTitle><AlertDescription>{errorMessage(generateMutation.error)}</AlertDescription></Alert> : null}
      {resultQuery.isError && !result && (resultQuery.error as ApiError).status !== 404 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos recuperar el resultado</AlertTitle><AlertDescription>{errorMessage(resultQuery.error)}</AlertDescription></Alert> : null}
      {stale ? null : result ? <div className="space-y-3" aria-live="polite"><Alert><CheckCircle2 aria-hidden="true" /><AlertTitle>Archivo generado correctamente</AlertTitle><AlertDescription>{result.reused ? "Se recuperó el resultado existente." : "El resultado está disponible para descargar."}</AlertDescription></Alert><ResultDetails result={result} /><Button disabled={isDownloading} onClick={() => void download()} type="button" variant="outline">{isDownloading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}{isDownloading ? "Descargando…" : "Descargar XLSX"}</Button></div> : null}
      {downloadError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos descargar el archivo</AlertTitle><AlertDescription>{downloadError}</AlertDescription></Alert> : null}
      {!result && !stale ? <Button disabled={!canGenerate || generateMutation.isPending} onClick={() => { if (!generateMutation.isPending) void generateMutation.mutateAsync(); }} type="button">{generateMutation.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}{generateMutation.isPending ? "Generando…" : "Generar archivo"}</Button> : null}
    </CardContent>
  </Card>;
}
