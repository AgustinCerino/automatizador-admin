"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateExecution } from "@/features/executions/api/use-create-execution";
import { getExecutionHref } from "@/features/executions/navigation";
import type { ProcessRead } from "@/features/processes/types";
import { ApiError } from "@/lib/api/errors";

interface NewExecutionDialogProps {
  process: ProcessRead;
}

export function NewExecutionDialog({ process }: NewExecutionDialogProps) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateExecution(process.id);
  const router = useRouter();

  function handleOpenChange(nextOpen: boolean) {
    if (mutation.isPending) {
      return;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      mutation.reset();
    }
  }

  async function handleCreate(): Promise<void> {
    if (mutation.isPending) {
      return;
    }

    try {
      const execution = await mutation.mutateAsync();
      const href = getExecutionHref(process.tipo, execution.id);
      setOpen(false);

      if (href) {
        router.push(href);
      }
    } catch {
      // El error normalizado permanece visible dentro del diálogo.
    }
  }

  const errorMessage = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : "No se pudo crear la ejecución."
    : undefined;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Nueva ejecución
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Nueva ejecución</DialogTitle>
          <DialogDescription>
            Se creará una nueva ejecución para {process.nombre}.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => void handleCreate()}
            type="button"
          >
            {mutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {mutation.isPending ? "Creando..." : "Crear ejecución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
