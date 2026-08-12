"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TransformationValidationIssue, TransformationValidationRead } from "@/features/transformations/types";

interface TransformationValidationPanelProps {
  errorMessage: string | null;
  isDirty: boolean;
  isPending: boolean;
  isSaved: boolean;
  onValidate: () => void;
  result: TransformationValidationRead | null;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function Issues({ issues, title, variant }: { issues: TransformationValidationIssue[]; title: string; variant: "warning" | "error" }) {
  if (!issues.length) return null;
  const Icon = variant === "error" ? AlertCircle : TriangleAlert;
  return <Alert variant={variant === "error" ? "destructive" : "default"}><Icon aria-hidden="true" /><AlertTitle>{title}</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-4">{issues.map((issue) => <li key={`${issue.code}-${issue.output_column ?? ""}-${issue.source_column ?? ""}`}>{issue.message}{issue.count > 1 ? ` (${issue.count})` : ""}</li>)}</ul></AlertDescription></Alert>;
}

export function TransformationValidationPanel({ errorMessage, isDirty, isPending, isSaved, onValidate, result }: TransformationValidationPanelProps) {
  const previewColumns = result?.columnas_salida ?? [];
  const isStale = Boolean(result && isDirty);

  return <Card>
    <CardHeader><CardTitle><h2>Validar transformación</h2></CardTitle><CardDescription>Probá la configuración guardada antes de generar el archivo definitivo.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {!isSaved ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Falta guardar la configuración</AlertTitle><AlertDescription>Guardá una configuración antes de validar. El dry-run siempre utiliza la configuración persistida.</AlertDescription></Alert> : null}
      {isSaved && isDirty ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Configuración modificada</AlertTitle><AlertDescription>Guardá los cambios antes de validar. El dry-run siempre utiliza la configuración persistida.</AlertDescription></Alert> : null}
      {isStale ? <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Validación desactualizada</AlertTitle><AlertDescription>El resultado anterior ya no corresponde al borrador actual.</AlertDescription></Alert> : null}
      {errorMessage ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos validar la transformación</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      <Button disabled={!isSaved || isDirty || isPending} onClick={onValidate} type="button">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}{isPending ? "Validando…" : "Validar transformación"}</Button>
      {result && !isStale ? <div className="space-y-4" aria-live="polite">
        <Alert variant={result.valid ? "default" : "destructive"}><CheckCircle2 aria-hidden="true" /><AlertTitle>{result.valid ? "Configuración guardada y validada" : "La configuración no es válida"}</AlertTitle><AlertDescription>{result.valid ? "El resultado mostrado corresponde a la configuración persistida." : "Corregí los errores indicados antes de generar el resultado."}</AlertDescription></Alert>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Metric label="Filas de entrada" value={result.total_filas_entrada} /><Metric label="Después de filtros" value={result.filas_despues_filtros} /><Metric label="Filas válidas" value={result.filas_validas} /><Metric label="Duplicados eliminados" value={result.duplicados_eliminados} /><Metric label="Filas con errores" value={result.filas_con_errores} /><Metric label="Filas con advertencias" value={result.filas_con_advertencias} /></dl>
        <Issues issues={result.errors} title="Errores funcionales" variant="error" /><Issues issues={result.warnings} title="Advertencias" variant="warning" />
        <div className="space-y-2"><h3 className="text-sm font-medium">Previsualización transformada</h3>{previewColumns.length ? <Table><TableHeader><TableRow>{previewColumns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{result.preview_rows.map((row, index) => <TableRow key={index}>{previewColumns.map((column) => <TableCell key={column}>{displayValue(row[column])}</TableCell>)}</TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">No hay columnas de salida para previsualizar.</p>}</div>
      </div> : null}
    </CardContent>
  </Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border p-3"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium">{value}</dd></div>;
}
