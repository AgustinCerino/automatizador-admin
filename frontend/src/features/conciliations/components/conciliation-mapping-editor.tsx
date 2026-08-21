"use client";

import { AlertCircle, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConciliationMapping, ConciliationMappingCreate } from "@/features/conciliations/types";
import { ApiError } from "@/lib/api/errors";

interface DraftMapping {
  columna_clave_archivo_a: string;
  columna_clave_archivo_b: string;
  columna_importe_archivo_a: string;
  columna_importe_archivo_b: string;
  detectar_duplicados: boolean;
  tolerancia_importe: string;
}

const EMPTY_DRAFT: DraftMapping = {
  columna_clave_archivo_a: "",
  columna_clave_archivo_b: "",
  columna_importe_archivo_a: "",
  columna_importe_archivo_b: "",
  detectar_duplicados: true,
  tolerancia_importe: "0",
};

function draftFromMapping(mapping: ConciliationMapping): DraftMapping {
  return {
    columna_clave_archivo_a: mapping.columna_clave_archivo_a,
    columna_clave_archivo_b: mapping.columna_clave_archivo_b,
    columna_importe_archivo_a: mapping.columna_importe_archivo_a,
    columna_importe_archivo_b: mapping.columna_importe_archivo_b,
    detectar_duplicados: mapping.detectar_duplicados,
    tolerancia_importe: String(mapping.tolerancia_importe),
  };
}

function sameDraft(left: DraftMapping, right: DraftMapping): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mappingErrorDescription(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos guardar el mapping. Intentá nuevamente.";
}

interface ConciliationMappingEditorProps {
  archivoAId: number | null;
  archivoBId: number | null;
  columnsA: readonly string[] | null;
  columnsB: readonly string[] | null;
  columnsError: unknown;
  mapping: ConciliationMapping | null;
  mappingError: unknown;
  mappingLoading: boolean;
  mappingSelectionDirty: boolean;
  onRetry: () => void;
  onRetryColumns: () => void;
  onSave: (mapping: ConciliationMappingCreate) => Promise<ConciliationMapping>;
  saving: boolean;
  saveError: unknown;
}

export function ConciliationMappingEditor({
  archivoAId,
  archivoBId,
  columnsA,
  columnsB,
  columnsError,
  mapping,
  mappingError,
  mappingLoading,
  mappingSelectionDirty,
  onRetry,
  onRetryColumns,
  onSave,
  saving,
  saveError,
}: ConciliationMappingEditorProps) {
  const mappingMatchesSelection = Boolean(
    mapping &&
      mapping.archivo_a_id === archivoAId &&
      mapping.archivo_b_id === archivoBId,
  );
  const savedDraft = useMemo(
    () => (mappingMatchesSelection && mapping ? draftFromMapping(mapping) : EMPTY_DRAFT),
    [mapping, mappingMatchesSelection],
  );
  const sourceKey = `${mappingMatchesSelection}:${JSON.stringify(savedDraft)}`;
  const [draftState, setDraftState] = useState({ draft: EMPTY_DRAFT, sourceKey: "" });
  const draft = draftState.sourceKey === sourceKey ? draftState.draft : savedDraft;
  const setDraft = (
    update: DraftMapping | ((current: DraftMapping) => DraftMapping),
  ) => {
    setDraftState((current) => {
      const currentDraft = current.sourceKey === sourceKey ? current.draft : savedDraft;
      return {
        draft: typeof update === "function" ? update(currentDraft) : update,
        sourceKey,
      };
    });
  };

  const columnsLoading = !columnsError && (columnsA === null || columnsB === null);
  const missingColumns =
    (draft.columna_clave_archivo_a !== "" && !columnsA?.includes(draft.columna_clave_archivo_a)) ||
    (draft.columna_importe_archivo_a !== "" && !columnsA?.includes(draft.columna_importe_archivo_a)) ||
    (draft.columna_clave_archivo_b !== "" && !columnsB?.includes(draft.columna_clave_archivo_b)) ||
    (draft.columna_importe_archivo_b !== "" && !columnsB?.includes(draft.columna_importe_archivo_b));
  const numericTolerance = Number(draft.tolerancia_importe);
  const validTolerance = draft.tolerancia_importe.trim() !== "" && Number.isFinite(numericTolerance);
  const complete = [
    draft.columna_clave_archivo_a,
    draft.columna_clave_archivo_b,
    draft.columna_importe_archivo_a,
    draft.columna_importe_archivo_b,
  ].every((column) => column !== "");
  const isDirty = !mappingMatchesSelection || !sameDraft(draft, savedDraft);
  const selectionReady = archivoAId !== null && archivoBId !== null && !mappingSelectionDirty;
  const canSave = selectionReady && !columnsLoading && !columnsError && complete && !missingColumns && validTolerance && isDirty && !saving;
  const disabled = !selectionReady || columnsLoading || Boolean(columnsError) || saving;

  async function saveMapping() {
    if (!canSave || archivoAId === null || archivoBId === null) return;
    try {
      await onSave({
        archivo_a_id: archivoAId,
        archivo_b_id: archivoBId,
        columna_clave_archivo_a: draft.columna_clave_archivo_a,
        columna_clave_archivo_b: draft.columna_clave_archivo_b,
        columna_importe_archivo_a: draft.columna_importe_archivo_a,
        columna_importe_archivo_b: draft.columna_importe_archivo_b,
        detectar_duplicados: draft.detectar_duplicados,
        tolerancia_importe: numericTolerance,
      });
    } catch {
      // La mutación conserva el borrador y expone el error controlado.
    }
  }

  if (mappingLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground" role="status">Cargando mapping guardado…</CardContent></Card>;
  }
  if (mappingError) {
    return <Card><CardContent className="py-6"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos recuperar el mapping</AlertTitle><AlertDescription><p>Intentá recargar la configuración.</p><Button className="mt-3" onClick={onRetry} type="button" variant="outline">Reintentar</Button></AlertDescription></Alert></CardContent></Card>;
  }
  if (!selectionReady) {
    return <Card><CardHeader><CardTitle><h2>Configuración de conciliación</h2></CardTitle></CardHeader><CardContent><p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{mappingSelectionDirty ? "Guardá los cambios de Archivo A/B antes de configurar el mapping." : "Seleccioná ambos archivos antes de configurar el mapping."}</p></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Configuración de conciliación</h2></CardTitle>
        <CardDescription>Definí las columnas de clave e importe para los archivos A y B.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!mappingMatchesSelection && mapping ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Mapping desactualizado</AlertTitle><AlertDescription>El mapping guardado corresponde a otro par de archivos. Revisá la configuración y guardala nuevamente.</AlertDescription></Alert> : null}
        {columnsLoading ? <p className="text-sm text-muted-foreground" role="status">Cargando columnas de los archivos seleccionados…</p> : null}
        {columnsError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos cargar las columnas</AlertTitle><AlertDescription><p>Reintentá cargar los previews antes de guardar el mapping.</p><Button className="mt-3" onClick={onRetryColumns} type="button" variant="outline">Reintentar previews</Button></AlertDescription></Alert> : null}
        {missingColumns ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Hay columnas que ya no existen</AlertTitle><AlertDescription>Seleccioná una columna válida antes de guardar. No reemplazamos columnas automáticamente.</AlertDescription></Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <ColumnSelect columns={columnsA ?? []} disabled={disabled} id="conciliation-key-a" label="Clave · Archivo A" onChange={(value) => setDraft((current) => ({ ...current, columna_clave_archivo_a: value }))} value={draft.columna_clave_archivo_a} />
          <ColumnSelect columns={columnsB ?? []} disabled={disabled} id="conciliation-key-b" label="Clave · Archivo B" onChange={(value) => setDraft((current) => ({ ...current, columna_clave_archivo_b: value }))} value={draft.columna_clave_archivo_b} />
          <ColumnSelect columns={columnsA ?? []} disabled={disabled} id="conciliation-amount-a" label="Importe · Archivo A" onChange={(value) => setDraft((current) => ({ ...current, columna_importe_archivo_a: value }))} value={draft.columna_importe_archivo_a} />
          <ColumnSelect columns={columnsB ?? []} disabled={disabled} id="conciliation-amount-b" label="Importe · Archivo B" onChange={(value) => setDraft((current) => ({ ...current, columna_importe_archivo_b: value }))} value={draft.columna_importe_archivo_b} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="conciliation-tolerance">Tolerancia de importe</Label><Input aria-invalid={!validTolerance} disabled={disabled} id="conciliation-tolerance" inputMode="decimal" onChange={(event) => setDraft((current) => ({ ...current, tolerancia_importe: event.target.value }))} type="number" value={draft.tolerancia_importe} /><p className="text-xs text-muted-foreground">Valor numérico; el backend valida la regla final.</p></div>
          <label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm"><input checked={draft.detectar_duplicados} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, detectar_duplicados: event.target.checked }))} type="checkbox" />Detectar duplicados</label>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{isDirty ? "Cambios sin guardar" : "Mapping sincronizado"}</p><Button disabled={!canSave} onClick={() => void saveMapping()} type="button"><Save aria-hidden="true" />{saving ? "Guardando…" : "Guardar mapping"}</Button></div>
        {saveError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos guardar el mapping</AlertTitle><AlertDescription>{mappingErrorDescription(saveError)}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
  );
}

function ColumnSelect({ columns, disabled, id, label, onChange, value }: { columns: readonly string[]; disabled: boolean; id: string; label: string; onChange: (value: string) => void; value: string }) {
  const unavailable = value !== "" && !columns.includes(value);
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select disabled={disabled} onValueChange={onChange} value={value || undefined}><SelectTrigger id={id}><SelectValue placeholder="Seleccioná una columna" /></SelectTrigger><SelectContent>{unavailable ? <SelectItem value={value}>{`Columna no disponible: ${value}`}</SelectItem> : null}{columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}</SelectContent></Select></div>;
}
