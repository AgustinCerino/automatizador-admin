"use client";

import { AlertCircle, LoaderCircle, Play, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ConciliationResult, ConciliationSummary } from "@/features/conciliations/types";
import { ApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format-values";

const RESULT_LABELS: Readonly<Record<string, string>> = {
  CONCILIADO: "Conciliado",
  DIFERENCIA_IMPORTE: "Diferencia de importe",
  SOLO_ARCHIVO_A: "Sólo archivo A",
  SOLO_ARCHIVO_B: "Sólo archivo B",
  DUPLICADO_ARCHIVO_A: "Duplicado en archivo A",
  DUPLICADO_ARCHIVO_B: "Duplicado en archivo B",
  ERROR_FORMATO: "Error de formato",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function RecordDetails({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const entries = Object.entries(value);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return <dl className="min-w-48 space-y-1 text-xs">
    {entries.map(([key, item]) => (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2" key={key}>
        <dt className="truncate text-muted-foreground" title={key}>{key}</dt>
        <dd className="truncate" title={renderValue(item)}>{renderValue(item)}</dd>
      </div>
    ))}
  </dl>;
}

function ResultState({ state }: { state: string }) {
  return <span aria-label={`Estado: ${RESULT_LABELS[state] ?? state}`} className="text-sm font-medium">{RESULT_LABELS[state] ?? state}</span>;
}

function Summary({ summary }: { summary: ConciliationSummary }) {
  const metrics = [
    ["Total resultados", summary.total_resultados],
    ["Conciliados", summary.conciliados],
    ["Diferencias de importe", summary.diferencias_importe],
    ["Sólo archivo A", summary.solo_archivo_a],
    ["Sólo archivo B", summary.solo_archivo_b],
    ["Duplicados archivo A", summary.duplicados_archivo_a],
    ["Duplicados archivo B", summary.duplicados_archivo_b],
    ["Errores de formato", summary.errores_formato],
    ["Requieren revisión", summary.requiere_revision],
  ] as const;
  return <Card>
    <CardHeader>
      <CardTitle><h2>Resultado de conciliación</h2></CardTitle>
      <CardDescription>Estado final: <StatusBadge status={summary.estado_ejecucion} /></CardDescription>
    </CardHeader>
    <CardContent>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{formatNumber(value)}</dd></div>)}
      </dl>
    </CardContent>
  </Card>;
}

function ResultsTable({ results }: { results: ConciliationResult[] }) {
  return <Card>
    <CardHeader><CardTitle><h2>Resultados</h2></CardTitle><CardDescription>Lectura de las filas producidas por el motor de conciliación.</CardDescription></CardHeader>
    <CardContent>
      {results.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">La conciliación se ejecutó correctamente y no produjo resultados.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Referencia</TableHead><TableHead>Estado</TableHead><TableHead>Archivo A</TableHead><TableHead>Archivo B</TableHead><TableHead>Diferencia</TableHead><TableHead>Observación</TableHead><TableHead>Requiere revisión</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.id}><TableCell className="font-medium">{result.clave_referencia ?? "—"}</TableCell><TableCell><ResultState state={result.estado_resultado} /></TableCell><TableCell><RecordDetails value={result.datos_archivo_a_json} /></TableCell><TableCell><RecordDetails value={result.datos_archivo_b_json} /></TableCell>{<TableCell>{result.diferencia_importe ?? "—"}</TableCell>}<TableCell>{result.observacion ?? "—"}</TableCell><TableCell>{result.requiere_revision ? "Sí" : "No"}</TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent>
  </Card>;
}

interface ConciliationResultsPanelProps {
  canExecute: boolean;
  configurationMessage: string | null;
  executing: boolean;
  executionError: unknown;
  onExecute: () => void;
  results: ConciliationResult[] | undefined;
  resultsError: unknown;
  resultsLoading: boolean;
  stale: boolean;
  summary: ConciliationSummary | null;
}

export function ConciliationResultsPanel({ canExecute, configurationMessage, executing, executionError, onExecute, results, resultsError, resultsLoading, stale, summary }: ConciliationResultsPanelProps) {
  return <section className="space-y-4" aria-label="Ejecución de conciliación">
    <Card><CardHeader><CardTitle><h2>Ejecutar conciliación</h2></CardTitle><CardDescription>Procesá explícitamente los archivos y el mapping guardados.</CardDescription></CardHeader><CardContent className="space-y-4">
      {configurationMessage ? <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Falta configuración vigente</AlertTitle><AlertDescription>{configurationMessage}</AlertDescription></Alert> : null}
      {stale ? <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Resultado desactualizado</AlertTitle><AlertDescription>Los archivos o el mapping cambiaron, o el backend no permite verificar la configuración que produjo el resultado. Ejecutá nuevamente para ver resultados vigentes.</AlertDescription></Alert> : null}
      {executionError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos ejecutar la conciliación</AlertTitle><AlertDescription>{errorMessage(executionError, "No pudimos comunicarnos con el servidor. Intentá nuevamente.")}</AlertDescription></Alert> : null}
      <Button disabled={!canExecute || executing} onClick={onExecute} type="button">{executing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}{executing ? "Ejecutando…" : summary && !stale ? "Reejecutar conciliación" : "Ejecutar conciliación"}</Button>
    </CardContent></Card>
    {!stale && summary ? <Summary summary={summary} /> : null}
    {!stale && summary && resultsLoading ? <Card><CardContent className="py-6 text-sm text-muted-foreground" role="status">Cargando resultados…</CardContent></Card> : null}
    {!stale && summary && resultsError ? <Card><CardContent className="py-6"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos cargar los resultados</AlertTitle><AlertDescription>{errorMessage(resultsError, "Intentá recargar la página.")}</AlertDescription></Alert></CardContent></Card> : null}
    {!stale && summary && results && !resultsLoading && !resultsError ? <ResultsTable results={results} /> : null}
  </section>;
}
