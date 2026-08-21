"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
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
  useConciliationPreviewQuery,
  useUploadConciliationFile,
} from "@/features/conciliations/api/use-conciliation-files";
import { ConciliationFilePreviewTable } from "@/features/conciliations/components/conciliation-file-preview";
import type { ConciliationFile } from "@/features/conciliations/types";
import { ApiError } from "@/lib/api/errors";

const NO_SELECTION = "none";

function errorDescription(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages: Partial<Record<number, string>> = {
    400: "El archivo no pudo procesarse como CSV o Excel.",
    403: "No tenés permisos para usar este archivo.",
    404: "El archivo seleccionado ya no existe.",
    413: "El archivo supera el tamaño permitido.",
    422: "El archivo debe ser CSV, XLS o XLSX.",
    503: "El servidor no está disponible.",
  };
  return messages[error.status] ?? fallback;
}

interface ConciliationFileSlotProps {
  executionId: number;
  files: readonly ConciliationFile[];
  onSelect: (fileId: number | null) => void;
  otherSelectedId: number | null;
  role: "A" | "B";
  selectedId: number | null;
}

export function ConciliationFileSlot({
  executionId,
  files,
  onSelect,
  otherSelectedId,
  role,
  selectedId,
}: ConciliationFileSlotProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadMutation = useUploadConciliationFile(executionId);
  const previewQuery = useConciliationPreviewQuery(executionId, selectedId);
  const selectedFile = files.find((file) => file.id === selectedId);
  const inputId = `conciliation-upload-${role.toLowerCase()}`;
  const selectId = `conciliation-select-${role.toLowerCase()}`;

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) return;
    try {
      const uploaded = await uploadMutation.mutateAsync(uploadFile);
      setUploadFile(null);
      onSelect(uploaded.id);
    } catch {
      // El estado de la mutación muestra el error controlado.
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>Archivo {role}</h2>
        </CardTitle>
        <CardDescription>
          Seleccioná uno de los archivos asociados o cargá uno nuevo.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor={selectId}>Archivo seleccionado para {role}</Label>
          <Select
            onValueChange={(value) =>
              onSelect(value === NO_SELECTION ? null : Number(value))
            }
            value={selectedId === null ? NO_SELECTION : String(selectedId)}
          >
            <SelectTrigger className="w-full" id={selectId}>
              <SelectValue placeholder="Sin seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SELECTION}>Sin seleccionar</SelectItem>
              {files.map((file) => (
                <SelectItem
                  disabled={file.id === otherSelectedId}
                  key={file.id}
                  value={String(file.id)}
                >
                  {file.nombre_original}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedFile
              ? `ID ${selectedFile.id} · ${selectedFile.extension?.toUpperCase() ?? "Sin extensión"}`
              : "Todavía no hay un archivo seleccionado."}
          </p>
        </div>

        <form className="space-y-3 rounded-lg border border-dashed p-4" onSubmit={submitUpload}>
          <Label htmlFor={inputId}>Cargar archivo para el slot {role}</Label>
          <Input
            accept=".csv,.xls,.xlsx"
            id={inputId}
            onChange={(event) => setUploadFile(event.target.files?.item(0) ?? null)}
            type="file"
          />
          <Button disabled={!uploadFile || uploadMutation.isPending} type="submit" variant="outline">
            <Upload aria-hidden="true" />
            {uploadMutation.isPending ? "Cargando…" : `Cargar para Archivo ${role}`}
          </Button>
          {uploadMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {errorDescription(uploadMutation.error, "No pudimos cargar el archivo.")}
            </p>
          ) : null}
          {uploadMutation.isSuccess ? (
            <p className="text-sm text-success-foreground" role="status">
              Archivo cargado. Guardá la selección para confirmarlo como {role}.
            </p>
          ) : null}
        </form>

        <section aria-labelledby={`preview-${role.toLowerCase()}-title`} className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 className="font-semibold" id={`preview-${role.toLowerCase()}-title`}>
              Preview {role}
            </h3>
          </div>
          {selectedId === null ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Seleccioná un archivo para ver su preview.
            </p>
          ) : null}
          {previewQuery.isPending && selectedId !== null ? (
            <div aria-label={`Cargando preview ${role}`} className="space-y-2" role="status">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}
          {previewQuery.isError ? (
            <ErrorState
              className="py-6"
              description={errorDescription(previewQuery.error, `No pudimos cargar el preview ${role}.`)}
              retry={() => void previewQuery.refetch()}
              title={`Preview ${role} no disponible`}
            />
          ) : null}
          {previewQuery.data ? (
            <ConciliationFilePreviewTable preview={previewQuery.data} role={role} />
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
