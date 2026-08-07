"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useTransformationSummaryQuery } from "@/features/transformations/api/use-transformation-summary-query";
import {
  ConfigurationSummaryCard,
  GenerationSummaryCard,
  NextActionCard,
  OperationalIssues,
  SourceSummaryCard,
  TransformationSteps,
  ValidationSummaryCard,
  WorkspaceHeader,
} from "@/features/transformations/components/workspace-sections";
import { WorkspaceSkeleton } from "@/features/transformations/components/workspace-skeleton";
import { ApiError } from "@/lib/api/errors";

interface TransformationWorkspaceProps {
  executionId: number;
}

function getErrorDescription(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "No pudimos cargar la información de la ejecución.";
  }

  const descriptions: Partial<Record<number, string>> = {
    400: "Esta ejecución no corresponde a una transformación Excel.",
    403: "No tenés permisos para acceder a esta ejecución.",
    404: "No se encontró la ejecución.",
    500: "No pudimos cargar la información de la ejecución.",
    503: "El servidor no está disponible.",
  };
  return descriptions[error.status] ?? "No pudimos cargar la información de la ejecución.";
}

export function TransformationWorkspace({ executionId }: TransformationWorkspaceProps) {
  const summaryQuery = useTransformationSummaryQuery(executionId);

  if (summaryQuery.isPending) {
    return <WorkspaceSkeleton />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    const canRetry =
      !(summaryQuery.error instanceof ApiError) || summaryQuery.error.status >= 500;

    return (
      <div className="space-y-4">
        <ErrorState
          description={getErrorDescription(summaryQuery.error)}
          retry={canRetry ? () => void summaryQuery.refetch() : undefined}
          title="No pudimos cargar la transformación."
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/ejecuciones">
              <ArrowLeft aria-hidden="true" />
              Volver a ejecuciones
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const executionsHref = `/procesos/${summary.proceso_id}/ejecuciones`;

  return (
    <div className="space-y-6">
      <PageHeader
        action={<WorkspaceHeader summary={summary} />}
        breadcrumbs={[
          { label: "Procesos", href: "/procesos" },
          { label: summary.proceso_nombre, href: executionsHref },
          { label: "Ejecuciones", href: executionsHref },
          { label: `Ejecución #${summary.ejecucion_id}` },
        ]}
        description={`Ejecución #${summary.ejecucion_id} · ${summary.proceso_nombre}`}
        title="Transformación Excel"
      />

      <TransformationSteps summary={summary} />
      <NextActionCard summary={summary} />

      <div className="grid gap-4 md:grid-cols-2">
        <SourceSummaryCard source={summary.source} />
        <ConfigurationSummaryCard summary={summary} />
        <ValidationSummaryCard validation={summary.validation} />
        <GenerationSummaryCard generation={summary.generation} />
      </div>

      <OperationalIssues summary={summary} />
    </div>
  );
}
