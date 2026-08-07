import type {
  TransformationAction,
  TransformationSummary,
} from "@/features/transformations/types";

export type ActionTone = "neutral" | "information" | "warning" | "error" | "success";
export type ActionIconName =
  | "settings"
  | "check"
  | "repair"
  | "generate"
  | "wait"
  | "download"
  | "refresh"
  | "alert"
  | "done";

export interface ActionPresentation {
  description: string;
  icon: ActionIconName;
  label: string;
  tone: ActionTone;
}

const ACTION_PRESENTATIONS: Record<TransformationAction, ActionPresentation> = {
  CONFIGURE: {
    description: "La ejecución necesita una configuración guardada.",
    icon: "settings",
    label: "Configurar transformación",
    tone: "information",
  },
  VALIDATE: {
    description: "La configuración está lista para ser validada.",
    icon: "check",
    label: "Validar configuración",
    tone: "information",
  },
  FIX_ERRORS: {
    description: "Hay errores que deben resolverse antes de continuar.",
    icon: "repair",
    label: "Corregir errores",
    tone: "error",
  },
  GENERATE: {
    description: "La validación permite avanzar a la generación del resultado.",
    icon: "generate",
    label: "Generar archivo",
    tone: "success",
  },
  WAIT: {
    description: "El servidor está procesando la transformación.",
    icon: "wait",
    label: "Procesamiento en curso",
    tone: "warning",
  },
  DOWNLOAD: {
    description: "El resultado fue generado y el archivo está disponible.",
    icon: "download",
    label: "Archivo listo para descargar",
    tone: "success",
  },
  REGENERATE: {
    description: "El resultado registrado debe volver a generarse.",
    icon: "refresh",
    label: "Regenerar archivo",
    tone: "warning",
  },
  REVIEW_ERROR: {
    description: "La ejecución requiere revisar un problema operativo.",
    icon: "alert",
    label: "Revisar problema",
    tone: "error",
  },
  NONE: {
    description: "La ejecución no requiere una acción operativa inmediata.",
    icon: "done",
    label: "Sin acciones pendientes",
    tone: "neutral",
  },
};

const UNKNOWN_ACTION: ActionPresentation = {
  description: "El servidor informó un estado que requiere revisión.",
  icon: "alert",
  label: "Revisar estado",
  tone: "warning",
};

export function getActionPresentation(action: string): ActionPresentation {
  return ACTION_PRESENTATIONS[action as TransformationAction] ?? UNKNOWN_ACTION;
}

export type TransformationStepId = "source" | "configuration" | "validation" | "result";
export type TransformationStepState =
  | "pending"
  | "current"
  | "completed"
  | "warning"
  | "error";

export interface TransformationStepPresentation {
  id: TransformationStepId;
  label: string;
  state: TransformationStepState;
}

const CURRENT_STEP_BY_ACTION: Partial<Record<TransformationAction, TransformationStepId>> = {
  CONFIGURE: "configuration",
  VALIDATE: "validation",
  FIX_ERRORS: "validation",
  GENERATE: "result",
  WAIT: "result",
  DOWNLOAD: "result",
  REGENERATE: "result",
};

export function getTransformationSteps(
  summary: TransformationSummary,
): TransformationStepPresentation[] {
  const sourceState: TransformationStepState = !summary.source
    ? "pending"
    : summary.source.file_exists
      ? "completed"
      : "error";
  const configurationState: TransformationStepState = summary.has_configuration
    ? "completed"
    : "pending";
  const validationState: TransformationStepState = !summary.validation.available
    ? "pending"
    : summary.validation.valid === true
      ? "completed"
      : summary.validation.valid === false
        ? "error"
        : "warning";
  const resultState: TransformationStepState = !summary.generation.available
    ? "pending"
    : summary.generation.file_exists
      ? "completed"
      : "error";

  const currentStep = CURRENT_STEP_BY_ACTION[summary.action_required];
  const steps: TransformationStepPresentation[] = [
    { id: "source", label: "Archivo", state: sourceState },
    { id: "configuration", label: "Configuración", state: configurationState },
    { id: "validation", label: "Validación", state: validationState },
    { id: "result", label: "Resultado", state: resultState },
  ];

  return steps.map((step) => ({
    ...step,
    state:
      step.id === currentStep && step.state === "pending" ? "current" : step.state,
  }));
}
