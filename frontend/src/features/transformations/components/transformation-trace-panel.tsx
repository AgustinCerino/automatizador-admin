"use client";

import { AlertCircle, CheckCircle2, Clock3, History, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransformationTraceQuery } from "@/features/transformations/api/use-transformation-summary-query";
import type { TransformationTraceEvent } from "@/features/transformations/types";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const levelPresentation = {
  ERROR: { icon: AlertCircle, label: "Error", styles: "border-destructive/25 bg-destructive/5" },
  INFO: { icon: CheckCircle2, label: "Información", styles: "border-border bg-card" },
  WARNING: { icon: TriangleAlert, label: "Advertencia", styles: "border-warning/35 bg-warning/10" },
} as const;

function TraceEvent({ event }: { event: TransformationTraceEvent }) {
  const presentation = levelPresentation[event.level];
  const Icon = presentation.icon;

  return (
    <li className={cn("rounded-lg border p-4", presentation.styles)}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon aria-hidden="true" className="size-4" />
        <Badge variant={event.level === "ERROR" ? "destructive" : "outline"}>
          {presentation.label}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{event.event_type}</span>
        <time className="ml-auto text-xs text-muted-foreground" dateTime={event.occurred_at}>
          {formatDateTime(event.occurred_at)}
        </time>
      </div>
      <p className="mt-3 text-sm leading-6">{event.message}</p>
      {event.from_state || event.to_state ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Estado: {event.from_state ?? "—"} → {event.to_state ?? "—"}
        </p>
      ) : null}
    </li>
  );
}

export function TransformationTracePanel({ executionId }: { executionId: number }) {
  const query = useTransformationTraceQuery(executionId);

  return (
    <Card aria-labelledby="transformation-trace-title">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2" id="transformation-trace-title">
            <History aria-hidden="true" className="size-5" />
            Historial operativo
          </h2>
        </CardTitle>
        <CardDescription>
          Eventos recientes de la ejecución, del más nuevo al más antiguo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div aria-label="Cargando historial operativo" className="space-y-3" role="status">
            <Skeleton className="h-24 w-full motion-reduce:animate-none" />
            <Skeleton className="h-24 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {query.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>No pudimos cargar el historial</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>El resto del workspace sigue disponible. Podés reintentar esta consulta.</p>
              <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {query.data && query.data.items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <Clock3 aria-hidden="true" className="mb-2 size-5" />
            Todavía no hay eventos operativos para esta ejecución.
          </div>
        ) : null}

        {query.data && query.data.items.length > 0 ? (
          <ol className="space-y-3">
            {query.data.items.map((event) => (
              <TraceEvent event={event} key={event.event_id} />
            ))}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
