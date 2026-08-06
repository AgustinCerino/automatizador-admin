"use client";

import { CheckCircle2, RefreshCw, ServerOff } from "lucide-react";

import { useHealthQuery } from "@/features/system/api/use-health-query";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BackendStatusCard() {
  const { data, error, isError, isPending, refetch } = useHealthQuery();

  if (isPending) {
    return (
      <Card aria-labelledby="system-status-title" size="sm">
        <CardHeader>
          <CardTitle aria-level={2} id="system-status-title" role="heading">
            Estado del sistema
          </CardTitle>
          <CardDescription>
            Disponibilidad del servidor de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            aria-live="polite"
            className="flex items-center gap-3 text-sm text-muted-foreground"
            role="status"
          >
            <Skeleton aria-hidden="true" className="size-8 rounded-full" />
            <span>Comprobando conexión con el servidor.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    const errorMessage =
      error instanceof ApiError
        ? error.message
        : "No se pudo comprobar el estado del servidor.";

    return (
      <Card aria-labelledby="system-status-title" size="sm">
        <CardHeader>
          <CardTitle aria-level={2} id="system-status-title" role="heading">
            Estado del sistema
          </CardTitle>
          <CardDescription>
            Disponibilidad del servidor de la aplicación.
          </CardDescription>
          <CardAction>
            <Badge variant="destructive">
              <ServerOff aria-hidden="true" data-icon="inline-start" />
              Servidor no disponible
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" role="alert">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button
              onClick={() => void refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="system-status-title" size="sm">
      <CardHeader>
        <CardTitle aria-level={2} id="system-status-title" role="heading">
          Estado del sistema
        </CardTitle>
        <CardDescription>
          Disponibilidad del servidor de la aplicación.
        </CardDescription>
        <CardAction>
          <Badge
            className="bg-success/10 text-success-foreground"
            variant="outline"
          >
            <CheckCircle2 aria-hidden="true" data-icon="inline-start" />
            Servidor conectado
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div aria-live="polite" role="status">
          <p className="text-sm text-muted-foreground">
            Estado informado:{" "}
            <span className="font-medium text-foreground">{data.status}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
