import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "error" | "information" | "neutral";

const statusTones: Readonly<Record<string, StatusTone>> = {
  ACTIVO: "success",
  INACTIVO: "neutral",
  CARGADO: "information",
  CONFIGURADO: "information",
  VALIDADO: "success",
  PROCESANDO: "warning",
  COMPLETADO: "success",
  ERROR: "error",
  CANCELADO: "neutral",
  APROBADO: "success",
  RECHAZADO: "error",
};

const toneClasses: Readonly<Record<StatusTone, string>> = {
  success: "border-success/25 bg-success/10 text-success-foreground",
  warning: "border-warning/35 bg-warning/15 text-warning-foreground",
  error: "border-destructive/25 bg-destructive/10 text-destructive",
  information:
    "border-information/25 bg-information/10 text-information-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status.trim().toUpperCase() || "SIN ESTADO";
  const tone = statusTones[label] ?? "neutral";

  return (
    <Badge
      className={cn("border", toneClasses[tone], className)}
      data-tone={tone}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
