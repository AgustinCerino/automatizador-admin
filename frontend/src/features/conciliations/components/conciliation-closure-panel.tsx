"use client";

import { CheckCircle2, Download, LoaderCircle, XCircle } from "lucide-react";
import { useRef, useState } from "react";

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/errors";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface ConciliationClosurePanelProps {
  state: string;
  pendingReviews?: number;
  stale: boolean;
  approving: boolean;
  approvalError: unknown;
  onApprove: () => Promise<void>;
  rejecting: boolean;
  rejectionError: unknown;
  onReject: (reason: string | null) => Promise<void>;
  exporting: boolean;
  exportError: unknown;
  onExport: () => Promise<void>;
}

export function ConciliationClosurePanel({
  state,
  pendingReviews,
  stale,
  approving,
  approvalError,
  onApprove,
  rejecting,
  rejectionError,
  onReject,
  exporting,
  exportError,
  onExport,
}: ConciliationClosurePanelProps) {
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [reason, setReason] = useState("");
  const approvalInFlight = useRef(false);
  const rejectionInFlight = useRef(false);
  const exportInFlight = useRef(false);
  const decisionAllowed = state === "REQUIERE_REVISION" && !stale;
  const approvalAllowed = decisionAllowed && pendingReviews === 0;
  const exportAllowed = state === "APROBADO" && !stale;

  async function approve() {
    if (!approvalAllowed || approving || approvalInFlight.current) return;
    approvalInFlight.current = true;
    try {
      await onApprove();
      setApprovalOpen(false);
    } catch {
      // El error controlado permanece visible y la confirmación sigue abierta.
    } finally {
      approvalInFlight.current = false;
    }
  }

  async function reject() {
    if (!decisionAllowed || rejecting || rejectionInFlight.current) return;
    rejectionInFlight.current = true;
    try {
      const normalizedReason = reason.trim();
      await onReject(normalizedReason.length > 0 ? normalizedReason : null);
      setRejectionOpen(false);
      setReason("");
    } catch {
      // Conserva el motivo para que el usuario pueda corregir o reintentar.
    } finally {
      rejectionInFlight.current = false;
    }
  }

  async function exportResults() {
    if (!exportAllowed || exporting || exportInFlight.current) return;
    exportInFlight.current = true;
    try {
      await onExport();
    } catch {
      // La mutación expone el error controlado.
    } finally {
      exportInFlight.current = false;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle><h2>Cierre administrativo</h2></CardTitle>
            <CardDescription>
              Aprobá o rechazá la revisión y descargá el XLSX aprobado.
            </CardDescription>
          </div>
          <StatusBadge status={state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stale ? (
          <Alert>
            <AlertTitle>Acciones pausadas</AlertTitle>
            <AlertDescription>
              Guardá o restaurá la configuración y reejecutá antes de cerrar o exportar.
            </AlertDescription>
          </Alert>
        ) : null}
        {approvalError ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos aprobar la conciliación</AlertTitle>
            <AlertDescription>{errorMessage(approvalError, "Intentá nuevamente.")}</AlertDescription>
          </Alert>
        ) : null}
        {rejectionError ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos rechazar la conciliación</AlertTitle>
            <AlertDescription>{errorMessage(rejectionError, "Intentá nuevamente.")}</AlertDescription>
          </Alert>
        ) : null}
        {exportError ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos descargar el XLSX</AlertTitle>
            <AlertDescription>{errorMessage(exportError, "Intentá nuevamente.")}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            disabled={!approvalAllowed || approving || rejecting}
            onClick={() => setApprovalOpen(true)}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" />
            {approving ? "Aprobando…" : "Aprobar conciliación"}
          </Button>
          <Button
            disabled={!decisionAllowed || approving || rejecting}
            onClick={() => setRejectionOpen(true)}
            type="button"
            variant="destructive"
          >
            <XCircle aria-hidden="true" />
            {rejecting ? "Rechazando…" : "Rechazar conciliación"}
          </Button>
          <Button
            disabled={!exportAllowed || exporting}
            onClick={() => void exportResults()}
            type="button"
            variant="outline"
          >
            {exporting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
            {exporting ? "Preparando XLSX…" : "Descargar XLSX"}
          </Button>
        </div>
        {state === "REQUIERE_REVISION" && pendingReviews !== undefined && pendingReviews > 0 ? (
          <p className="text-sm text-muted-foreground">
            Completá las {pendingReviews} revisiones pendientes antes de aprobar.
          </p>
        ) : null}
      </CardContent>

      <Dialog onOpenChange={setApprovalOpen} open={approvalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprobación</DialogTitle>
            <DialogDescription>
              La ejecución quedará en estado APROBADO y ya no admitirá cambios de revisión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button disabled={approving} variant="outline">Cancelar</Button></DialogClose>
            <Button disabled={approving} onClick={() => void approve()} type="button">
              {approving ? "Aprobando…" : "Confirmar aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setRejectionOpen} open={rejectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar rechazo</DialogTitle>
            <DialogDescription>
              La ejecución quedará en estado RECHAZADO. El motivo es opcional según el contrato actual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="conciliation-rejection-reason">Motivo</Label>
            <Textarea
              disabled={rejecting}
              id="conciliation-rejection-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describí el motivo del rechazo"
              value={reason}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button disabled={rejecting} variant="outline">Cancelar</Button></DialogClose>
            <Button disabled={rejecting} onClick={() => void reject()} type="button" variant="destructive">
              {rejecting ? "Rechazando…" : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
