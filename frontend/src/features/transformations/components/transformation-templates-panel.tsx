"use client";

import { AlertCircle, FilePlus2, LoaderCircle, Pencil, Power, Shapes } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useApplyTransformationTemplate,
  useCreateTransformationTemplate,
  useDeactivateTransformationTemplate,
  useTransformationTemplatesQuery,
  useUpdateTransformationTemplate,
} from "@/features/transformations/api/use-templates";
import type {
  TransformationExcelConfigRead,
  TransformationSummary,
  TransformationTemplateRead,
} from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";

interface TransformationTemplatesPanelProps {
  canManage: boolean;
  hasLocalChanges: boolean;
  onApplied: (configuration: TransformationExcelConfigRead) => void;
  source: { fileId: number | null; headerRow: number; sheet: string | null };
  summary: TransformationSummary;
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos completar la operación con la plantilla.";
  if (error.status === 409) return "La operación entra en conflicto con el estado actual o con otra plantilla.";
  if (error.status === 422) return "Revisá los datos ingresados.";
  if (error.status === 403) return "No tenés permisos para administrar esta plantilla.";
  if (error.status === 404) return "La plantilla ya no está disponible.";
  if (error.status === 503) return "El servidor no está disponible.";
  return error.message || "No pudimos completar la operación con la plantilla.";
}

function OperationError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>No pudimos completar la operación</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  );
}

function TemplateMetadataFields({
  description,
  disabled,
  name,
  prefix,
  setDescription,
  setName,
}: {
  description: string;
  disabled: boolean;
  name: string;
  prefix: string;
  setDescription: (value: string) => void;
  setName: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-name`}>Nombre</Label>
        <Input
          disabled={disabled}
          id={`${prefix}-name`}
          maxLength={150}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-description`}>Descripción (opcional)</Label>
        <Textarea
          disabled={disabled}
          id={`${prefix}-description`}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </div>
    </div>
  );
}

export function TransformationTemplatesPanel({
  canManage,
  hasLocalChanges,
  onApplied,
  source,
  summary,
}: TransformationTemplatesPanelProps) {
  const query = useTransformationTemplatesQuery(summary.ejecucion_id, summary.proceso_id);
  const createMutation = useCreateTransformationTemplate(summary.ejecucion_id, summary.proceso_id);
  const applyMutation = useApplyTransformationTemplate(summary.ejecucion_id, summary.proceso_id);
  const updateMutation = useUpdateTransformationTemplate(summary.ejecucion_id, summary.proceso_id);
  const deactivateMutation = useDeactivateTransformationTemplate(summary.ejecucion_id, summary.proceso_id);
  const [selectedId, setSelectedId] = useState<number | null>(summary.template?.plantilla_id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [appliedName, setAppliedName] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const selected = items.find((template) => template.id === selectedId) ?? null;
  const canApply = summary.can_edit_configuration && source.fileId !== null && selected !== null;

  useEffect(() => {
    if (selectedId !== null && items.some((template) => template.id === selectedId)) return;
    const preferred = items.find((template) => template.id === summary.template?.plantilla_id) ?? items[0];
    queueMicrotask(() => setSelectedId(preferred?.id ?? null));
  }, [items, selectedId, summary.template?.plantilla_id]);

  function resetMutations() {
    createMutation.reset();
    applyMutation.reset();
    updateMutation.reset();
    deactivateMutation.reset();
  }

  function openCreate() {
    resetMutations();
    setName("");
    setDescription("");
    setCreateOpen(true);
  }

  function openEdit(template: TransformationTemplateRead) {
    resetMutations();
    setName(template.nombre);
    setDescription(template.descripcion ?? "");
    setEditOpen(true);
  }

  async function createTemplate() {
    if (!name.trim() || createMutation.isPending || inFlight.current) return;
    inFlight.current = "create";
    try {
      const created = await createMutation.mutateAsync({ nombre: name.trim(), descripcion: description.trim() || null });
      setSelectedId(created.id);
      setCreateOpen(false);
    } catch {
      // El error controlado queda visible sin perder los datos del formulario.
    } finally {
      inFlight.current = null;
    }
  }

  async function applyTemplate() {
    if (!selected || source.fileId === null || applyMutation.isPending || inFlight.current) return;
    inFlight.current = "apply";
    try {
      const configuration = await applyMutation.mutateAsync({
        input: { archivo_id: source.fileId, header_row: source.headerRow, sheet_name: source.sheet },
        templateId: selected.id,
      });
      onApplied(configuration);
      setAppliedName(selected.nombre);
      setApplyOpen(false);
    } catch {
      // El constructor sólo cambia después de una respuesta exitosa completa.
    } finally {
      inFlight.current = null;
    }
  }

  async function updateTemplate() {
    if (!selected || !name.trim() || updateMutation.isPending || inFlight.current) return;
    inFlight.current = "update";
    try {
      await updateMutation.mutateAsync({
        input: { nombre: name.trim(), descripcion: description.trim() || null },
        templateId: selected.id,
      });
      setEditOpen(false);
    } catch {
      // Conserva el formulario para corregir o reintentar.
    } finally {
      inFlight.current = null;
    }
  }

  async function deactivateTemplate() {
    if (!selected || deactivateMutation.isPending || inFlight.current) return;
    inFlight.current = "deactivate";
    try {
      await deactivateMutation.mutateAsync(selected.id);
      setSelectedId(null);
      setDeactivateOpen(false);
    } catch {
      // La selección permanece estable si el backend rechaza la operación.
    } finally {
      inFlight.current = null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle><h2>Plantillas reutilizables</h2></CardTitle>
            <CardDescription>Guardá o aplicá configuraciones del proceso sin ejecutar la transformación.</CardDescription>
          </div>
          {summary.template ? <StatusBadge status="APLICADA" /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.template ? (
          <p className="text-sm">
            Plantilla en uso: <span className="font-medium">{summary.template.nombre}</span>
            {summary.template.applied_at ? ` · ${formatDate(summary.template.applied_at)}` : ""}
          </p>
        ) : null}
        {appliedName ? <p className="text-sm text-success-foreground" role="status">Plantilla aplicada: {appliedName}. La configuración quedó pendiente de validación.</p> : null}
        {query.isPending ? <p className="text-sm text-muted-foreground">Cargando plantillas…</p> : null}
        {query.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>No pudimos cargar las plantillas</AlertTitle>
            <AlertDescription>La configuración actual no fue modificada. <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">Reintentar</Button></AlertDescription>
          </Alert>
        ) : null}
        {!query.isPending && !query.isError && items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay plantillas activas disponibles para este proceso.</p>
        ) : null}
        {items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label>Plantilla seleccionada</Label>
              <Select onValueChange={(value) => { resetMutations(); setAppliedName(null); setSelectedId(Number(value)); }} value={selectedId === null ? "" : String(selectedId)}>
                <SelectTrigger aria-label="Plantilla seleccionada"><SelectValue placeholder="Seleccioná una plantilla" /></SelectTrigger>
                <SelectContent>{items.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button disabled={!canApply || applyMutation.isPending} onClick={() => { resetMutations(); setApplyOpen(true); }} type="button">
              <Shapes aria-hidden="true" />Aplicar plantilla
            </Button>
          </div>
        ) : null}
        {selected ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{selected.nombre}</p>
            <p className="mt-1 text-muted-foreground">{selected.descripcion ?? "Sin descripción."}</p>
            <p className="mt-2 text-xs text-muted-foreground">Actualizada: {formatDate(selected.updated_at ?? selected.created_at)} · Versión {selected.schema_version}</p>
          </div>
        ) : null}
        {!source.fileId && items.length > 0 ? <p className="text-sm text-muted-foreground">Seleccioná e inspeccioná un archivo fuente antes de aplicar una plantilla.</p> : null}
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!summary.has_configuration || createMutation.isPending} onClick={openCreate} type="button" variant="outline"><FilePlus2 aria-hidden="true" />Guardar como plantilla</Button>
            <Button disabled={!selected || updateMutation.isPending} onClick={() => selected && openEdit(selected)} type="button" variant="outline"><Pencil aria-hidden="true" />Editar</Button>
            <Button disabled={!selected || deactivateMutation.isPending} onClick={() => { resetMutations(); setDeactivateOpen(true); }} type="button" variant="outline"><Power aria-hidden="true" />Desactivar</Button>
          </div>
        ) : null}
        {canManage && !summary.has_configuration ? <p className="text-sm text-muted-foreground">Guardá primero una configuración válida para crear una plantilla.</p> : null}
      </CardContent>

      <Dialog onOpenChange={(open) => { if (!createMutation.isPending) setCreateOpen(open); }} open={createOpen}>
        <DialogContent><DialogHeader><DialogTitle>Guardar como plantilla</DialogTitle><DialogDescription>Se copiará la configuración persistida actual de esta ejecución.</DialogDescription></DialogHeader><OperationError error={createMutation.error} /><TemplateMetadataFields description={description} disabled={createMutation.isPending} name={name} prefix="create-template" setDescription={setDescription} setName={setName} /><DialogFooter><DialogClose asChild><Button disabled={createMutation.isPending} variant="outline">Cancelar</Button></DialogClose><Button disabled={!name.trim() || createMutation.isPending} onClick={() => void createTemplate()} type="button">{createMutation.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{createMutation.isPending ? "Guardando…" : "Guardar plantilla"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!applyMutation.isPending) setApplyOpen(open); }} open={applyOpen}>
        <DialogContent><DialogHeader><DialogTitle>Aplicar {selected?.nombre ?? "plantilla"}</DialogTitle><DialogDescription>La plantilla reemplazará la configuración persistida de esta ejecución. No se generará ningún archivo.</DialogDescription></DialogHeader><OperationError error={applyMutation.error} />{hasLocalChanges ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Hay cambios locales sin guardar</AlertTitle><AlertDescription>Si continuás, esos cambios serán reemplazados por la plantilla seleccionada.</AlertDescription></Alert> : null}<DialogFooter><DialogClose asChild><Button disabled={applyMutation.isPending} variant="outline">Cancelar</Button></DialogClose><Button disabled={!canApply || applyMutation.isPending} onClick={() => void applyTemplate()} type="button">{applyMutation.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{applyMutation.isPending ? "Aplicando…" : "Confirmar aplicación"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!updateMutation.isPending) setEditOpen(open); }} open={editOpen}>
        <DialogContent><DialogHeader><DialogTitle>Editar plantilla</DialogTitle><DialogDescription>Actualizá el nombre o la descripción. La configuración reutilizable no cambia.</DialogDescription></DialogHeader><OperationError error={updateMutation.error} /><TemplateMetadataFields description={description} disabled={updateMutation.isPending} name={name} prefix="edit-template" setDescription={setDescription} setName={setName} /><DialogFooter><DialogClose asChild><Button disabled={updateMutation.isPending} variant="outline">Cancelar</Button></DialogClose><Button disabled={!name.trim() || updateMutation.isPending} onClick={() => void updateTemplate()} type="button">{updateMutation.isPending ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!deactivateMutation.isPending) setDeactivateOpen(open); }} open={deactivateOpen}>
        <DialogContent><DialogHeader><DialogTitle>Desactivar {selected?.nombre ?? "plantilla"}</DialogTitle><DialogDescription>La plantilla dejará de estar disponible para nuevas aplicaciones. No se eliminará físicamente.</DialogDescription></DialogHeader><OperationError error={deactivateMutation.error} /><DialogFooter><DialogClose asChild><Button disabled={deactivateMutation.isPending} variant="outline">Cancelar</Button></DialogClose><Button disabled={!selected || deactivateMutation.isPending} onClick={() => void deactivateTemplate()} type="button" variant="destructive">{deactivateMutation.isPending ? "Desactivando…" : "Confirmar desactivación"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </Card>
  );
}
