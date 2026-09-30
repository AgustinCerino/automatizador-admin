"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadTransformationResult } from "@/features/transformations/api/download-transformation-result";
import { useTransformationSummaryQuery } from "@/features/transformations/api/use-transformation-summary-query";
import { ApiError } from "@/lib/api/errors";

interface TransformationExecutionActionsProps {
  executionId: number;
  fallbackFilename?: string;
}

function getDownloadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "El archivo ya no está disponible para descargar.";
  }
  return error instanceof ApiError
    ? error.message
    : "No pudimos comunicarnos con el servidor.";
}

export function TransformationExecutionActions({
  executionId,
  fallbackFilename,
}: TransformationExecutionActionsProps) {
  const summaryQuery = useTransformationSummaryQuery(executionId);
  const downloadInFlight = useRef(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!summaryQuery.data?.can_download) return null;

  async function download(): Promise<void> {
    if (downloadInFlight.current) return;

    downloadInFlight.current = true;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadTransformationResult(executionId, fallbackFilename);
    } catch (error) {
      setDownloadError(getDownloadErrorMessage(error));
    } finally {
      downloadInFlight.current = false;
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        disabled={isDownloading}
        onClick={() => void download()}
        size="sm"
        type="button"
        variant="outline"
      >
        {isDownloading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {isDownloading ? "Descargando…" : "Descargar resultado"}
      </Button>
      {downloadError ? (
        <p className="max-w-64 text-sm text-destructive" role="alert">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
}
