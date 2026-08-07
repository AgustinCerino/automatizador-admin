import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  FileOutput,
  LoaderCircle,
  RefreshCw,
  Settings2,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getActionPresentation,
  getTransformationSteps,
  type ActionIconName,
  type ActionTone,
  type TransformationStepState,
} from "@/features/transformations/presentation";
import type {
  TransformationGeneration,
  TransformationIssue,
  TransformationSource,
  TransformationSummary,
  TransformationValidation,
} from "@/features/transformations/types";
import { formatDateTime } from "@/lib/format-date";
import {
  abbreviateChecksum,
  formatFileSize,
  formatNumber,
} from "@/lib/format-values";
import { cn } from "@/lib/utils";

const actionIcons: Record<ActionIconName, LucideIcon> = {
  alert: AlertCircle,
  check: Check,
  done: CheckCircle2,
  download: Download,
  generate: FileOutput,
  refresh: RefreshCw,
  repair: Wrench,
  settings: Settings2,
  wait: LoaderCircle,
};

const actionToneClasses: Record<ActionTone, string> = {
  error: "border-destructive/25 bg-destructive/5 text-destructive",
  information: "border-information/25 bg-information/5 text-information-foreground",
  neutral: "border-border bg-card text-foreground",
  success: "border-success/25 bg-success/5 text-success-foreground",
  warning: "border-warning/35 bg-warning/10 text-warning-foreground",
};

const stepStateLabels: Record<TransformationStepState, string> = {
  completed: "Completada",
  current: "Etapa actual",
  error: "Con error",
  pending: "Pendiente",
  warning: "Con advertencias",
};

const stepStateClasses: Record<TransformationStepState, string> = {
  completed: "border-success/30 bg-success/10 text-success-foreground",
  current: "border-information/35 bg-information/10 text-information-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  pending: "border-border bg-muted/50 text-muted-foreground",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
};

function StepIcon({ state }: { state: TransformationStepState }) {
  const Icon =
    state === "completed"
      ? CheckCircle2
      : state === "error"
        ? AlertCircle
        : state === "warning"
          ? TriangleAlert
          : state === "current"
            ? Clock3
            : Circle;
  return <Icon aria-hidden="true" className="size-5 shrink-0" />;
}

export function TransformationSteps({ summary }: { summary: TransformationSummary }) {
  const steps = getTransformationSteps(summary);

  return (
    <section aria-labelledby="transformation-steps-title">
      <h2 className="sr-only" id="transformation-steps-title">
        Etapas de la transformación
      </h2>
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <li
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3",
              stepStateClasses[step.state],
            )}
            data-state={step.state}
            key={step.id}
          >
            <StepIcon state={step.state} />
            <span className="min-w-0">
              <span className="block text-xs font-medium opacity-75">
                Etapa {index + 1}
              </span>
              <span className="block truncate font-medium">{step.label}</span>
              <span className="block text-xs opacity-80">
                {stepStateLabels[step.state]}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NextActionCard({ summary }: { summary: TransformationSummary }) {
  const presentation = getActionPresentation(summary.action_required);
  const Icon = actionIcons[presentation.icon];
  const isWaiting = summary.action_required === "WAIT";

  return (
    <section
      aria-labelledby="next-action-title"
      className={cn(
        "flex items-start gap-4 rounded-xl border p-5",
        actionToneClasses[presentation.tone],
      )}
    >
      <div className="mt-0.5 rounded-lg bg-current/10 p-2">
        <Icon
          aria-hidden="true"
          className={cn("size-5", isWaiting && "animate-spin motion-reduce:animate-none")}
        />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
          Próxima acción
        </p>
        <h2 className="mt-1 text-lg font-semibold" id="next-action-title">
          {presentation.label}
        </h2>
        <p className="mt-1 text-sm leading-6 opacity-80">
          {presentation.description}
        </p>
      </div>
    </section>
  );
}

function DataList({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceSummaryCard({ source }: { source: TransformationSource | null | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Archivo fuente</h2></CardTitle>
        <CardDescription>
          {source ? source.nombre_original : "Sin archivo"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!source ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Todavía no hay un archivo fuente asociado a esta ejecución.
          </p>
        ) : (
          <>
            {!source.file_exists ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Archivo no disponible</AlertTitle>
                <AlertDescription>
                  El archivo fuente ya no está disponible.
                </AlertDescription>
              </Alert>
            ) : null}
            <DataList
              items={[
                { label: "Nombre", value: source.nombre_original },
                { label: "Extensión", value: source.extension ?? "—" },
                { label: "Hoja", value: source.sheet_name ?? "—" },
                { label: "Fila de encabezado", value: formatNumber(source.header_row) },
                {
                  label: "Disponibilidad",
                  value: source.file_exists ? "Disponible" : "No disponible",
                },
                { label: "Checksum", value: abbreviateChecksum(source.checksum) },
              ]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ConfigurationSummaryCard({ summary }: { summary: TransformationSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Configuración</h2></CardTitle>
        <CardDescription>
          {summary.has_configuration ? "Configuración guardada" : "Sin configurar"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {summary.has_configuration
            ? "La ejecución tiene una configuración persistida."
            : "La transformación todavía no tiene una configuración guardada."}
        </p>
        {summary.template ? (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plantilla aplicada
            </p>
            <p className="mt-1 font-medium">{summary.template.nombre}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Versión {summary.template.schema_version}
              {summary.template.applied_at
                ? ` · ${formatDateTime(summary.template.applied_at)}`
                : ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function validationItems(validation: TransformationValidation) {
  return [
    { label: "Filas de entrada", value: validation.total_filas_entrada },
    { label: "Filas válidas", value: validation.filas_validas },
    { label: "Filas con errores", value: validation.filas_con_errores },
    { label: "Filas con advertencias", value: validation.filas_con_advertencias },
    { label: "Duplicados eliminados", value: validation.duplicados_eliminados },
  ].filter((item): item is { label: string; value: number } => item.value != null);
}

export function ValidationSummaryCard({ validation }: { validation: TransformationValidation }) {
  const metrics = validationItems(validation);
  const resultLabel =
    validation.valid === true
      ? "Validación correcta"
      : validation.valid === false
        ? "Validación con errores"
        : "Resultado no disponible";

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Validación</h2></CardTitle>
        <CardDescription>
          {validation.available ? resultLabel : "Pendiente de validación."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!validation.available ? (
          <p className="text-sm leading-6 text-muted-foreground">
            La configuración todavía no fue validada.
          </p>
        ) : (
          <>
            <Badge
              className={cn(
                "border",
                validation.valid === true && "border-success/25 bg-success/10 text-success-foreground",
                validation.valid === false && "border-destructive/25 bg-destructive/10 text-destructive",
              )}
              variant="outline"
            >
              {resultLabel}
            </Badge>
            {metrics.length ? (
              <DataList
                items={metrics.map((metric) => ({
                  label: metric.label,
                  value: formatNumber(metric.value),
                }))}
              />
            ) : null}
            {validation.validated_at ? (
              <p className="text-xs text-muted-foreground">
                Validada el {formatDateTime(validation.validated_at)}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function GenerationSummaryCard({ generation }: { generation: TransformationGeneration }) {
  const columnCount = generation.columnas_salida?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Resultado</h2></CardTitle>
        <CardDescription>
          {generation.available
            ? generation.nombre_archivo ?? "Archivo generado"
            : "Pendiente de generación"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!generation.available ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Todavía no se generó un archivo de salida.
          </p>
        ) : (
          <>
            {!generation.file_exists ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Resultado no disponible</AlertTitle>
                <AlertDescription>
                  El archivo generado ya no está disponible.
                </AlertDescription>
              </Alert>
            ) : null}
            <DataList
              items={[
                { label: "Archivo", value: generation.nombre_archivo ?? "—" },
                { label: "Filas", value: formatNumber(generation.total_filas) },
                { label: "Columnas", value: `${formatNumber(columnCount)} columnas` },
                { label: "Tamaño", value: formatFileSize(generation.size_bytes) },
                {
                  label: "Generado",
                  value: formatDateTime(generation.generated_at),
                },
                { label: "Checksum", value: abbreviateChecksum(generation.checksum) },
              ]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatSampleValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }
  return "Dato complejo";
}

function IssueItem({ issue }: { issue: TransformationIssue }) {
  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        issue.severity === "ERROR"
          ? "border-destructive/25 bg-destructive/5"
          : "border-warning/35 bg-warning/10",
      )}
      role={issue.severity === "ERROR" ? "alert" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={issue.severity === "ERROR" ? "destructive" : "outline"}>
          {issue.severity === "ERROR" ? "Error" : "Advertencia"}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
        {issue.count > 1 ? (
          <Badge variant="secondary">{formatNumber(issue.count)} casos</Badge>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-6">{issue.message}</p>
      {issue.output_column || issue.source_column ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {issue.output_column ? `Salida: ${issue.output_column}` : ""}
          {issue.output_column && issue.source_column ? " · " : ""}
          {issue.source_column ? `Origen: ${issue.source_column}` : ""}
        </p>
      ) : null}
      {issue.sample_rows?.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Filas de ejemplo</p>
          {issue.sample_rows.map((row, rowIndex) => (
            <dl
              className="grid gap-2 rounded-md border bg-card/80 p-3 text-xs sm:grid-cols-2"
              key={`${issue.code}-${rowIndex}`}
            >
              {Object.entries(row).map(([key, value]) => (
                <div className="min-w-0" key={key}>
                  <dt className="truncate font-medium text-muted-foreground">{key}</dt>
                  <dd className="mt-0.5 break-words">{formatSampleValue(value)}</dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function OperationalIssues({ summary }: { summary: TransformationSummary }) {
  if (!summary.issues.length) {
    return (
      <section
        aria-labelledby="operational-issues-title"
        className="rounded-xl border border-success/25 bg-success/5 p-5"
      >
        <h2 className="font-semibold text-success-foreground" id="operational-issues-title">
          Sin problemas detectados
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El resumen operativo no informa errores ni advertencias.
        </p>
      </section>
    );
  }

  const issues = [
    ...summary.issues.filter((issue) => issue.severity === "ERROR"),
    ...summary.issues.filter((issue) => issue.severity === "WARNING"),
  ];

  return (
    <section aria-labelledby="operational-issues-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold" id="operational-issues-title">
          Problemas operativos
        </h2>
        <Badge variant="destructive">{formatNumber(summary.errors_count)} errores</Badge>
        <Badge variant="outline">{formatNumber(summary.warnings_count)} advertencias</Badge>
      </div>
      <div className="space-y-3">
        {issues.map((issue, index) => (
          <IssueItem issue={issue} key={`${issue.severity}-${issue.code}-${index}`} />
        ))}
      </div>
    </section>
  );
}

export function WorkspaceHeader({ summary }: { summary: TransformationSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <StatusBadge status={summary.estado_ejecucion} />
      {summary.created_at ? <span>Creada {formatDateTime(summary.created_at)}</span> : null}
      {summary.updated_at ? <span>Actualizada {formatDateTime(summary.updated_at)}</span> : null}
    </div>
  );
}
