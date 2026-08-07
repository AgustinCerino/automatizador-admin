import type { ExecutionRead } from "@/features/executions/types";
import type { ProcessRead } from "@/features/processes/types";
import type {
  TransformationSourceFile,
  TransformationSourceStructure,
} from "@/features/transformations/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseProcessRead(value: unknown): ProcessRead | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isInteger(value.id) ||
    typeof value.cliente_id !== "number" ||
    !Number.isInteger(value.cliente_id) ||
    typeof value.nombre !== "string" ||
    typeof value.tipo !== "string" ||
    !isNullableString(value.descripcion) ||
    typeof value.estado !== "string" ||
    typeof value.created_at !== "string" ||
    !isNullableString(value.updated_at)
  ) {
    return undefined;
  }

  return {
    cliente_id: value.cliente_id,
    created_at: value.created_at,
    descripcion: value.descripcion,
    estado: value.estado,
    id: value.id,
    nombre: value.nombre,
    tipo: value.tipo,
    updated_at: value.updated_at,
  };
}

export function parseProcessList(value: unknown): ProcessRead[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const processes = value.map(parseProcessRead);
  return processes.every((process) => process !== undefined)
    ? processes
    : undefined;
}

export function parseExecutionRead(value: unknown): ExecutionRead | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isInteger(value.id) ||
    typeof value.proceso_id !== "number" ||
    !Number.isInteger(value.proceso_id) ||
    typeof value.usuario_id !== "number" ||
    !Number.isInteger(value.usuario_id) ||
    typeof value.estado !== "string" ||
    (value.resumen_json !== null && !isRecord(value.resumen_json)) ||
    !isNullableString(value.error_message) ||
    typeof value.started_at !== "string" ||
    !isNullableString(value.finished_at) ||
    typeof value.created_at !== "string"
  ) {
    return undefined;
  }

  return {
    created_at: value.created_at,
    error_message: value.error_message,
    estado: value.estado,
    finished_at: value.finished_at,
    id: value.id,
    proceso_id: value.proceso_id,
    resumen_json: value.resumen_json,
    started_at: value.started_at,
    usuario_id: value.usuario_id,
  };
}

export function parseExecutionList(
  value: unknown,
): ExecutionRead[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const executions = value.map(parseExecutionRead);
  return executions.every((execution) => execution !== undefined)
    ? executions
    : undefined;
}

export function parseTransformationSourceFile(
  value: unknown,
): TransformationSourceFile | undefined {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    !isPositiveInteger(value.ejecucion_id) ||
    typeof value.tipo_archivo !== "string" ||
    typeof value.nombre_original !== "string" ||
    typeof value.ruta_storage !== "string" ||
    !isNullableString(value.extension) ||
    !isNullableString(value.mime_type) ||
    (value.size_bytes !== null && !isNonNegativeInteger(value.size_bytes)) ||
    !isNullableString(value.checksum) ||
    typeof value.uploaded_at !== "string"
  ) {
    return undefined;
  }

  return {
    ejecucion_id: value.ejecucion_id,
    extension: value.extension,
    id: value.id,
    mime_type: value.mime_type,
    nombre_original: value.nombre_original,
    size_bytes: value.size_bytes,
    tipo_archivo: value.tipo_archivo,
    uploaded_at: value.uploaded_at,
  };
}

export function parseTransformationSourceFileList(
  value: unknown,
): TransformationSourceFile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const files = value.map(parseTransformationSourceFile);
  return files.every((file) => file !== undefined) ? files : undefined;
}

const DETECTED_TYPES = new Set([
  "text",
  "integer",
  "decimal",
  "date",
  "boolean",
  "unknown",
]);

export function parseTransformationSourceStructure(
  value: unknown,
): TransformationSourceStructure | undefined {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.archivo_id) ||
    typeof value.nombre_original !== "string" ||
    !isNullableString(value.extension) ||
    !Array.isArray(value.available_sheets) ||
    !value.available_sheets.every((sheet) => typeof sheet === "string") ||
    !isNullableString(value.selected_sheet_name) ||
    !isPositiveInteger(value.header_row) ||
    !Array.isArray(value.columns) ||
    !value.columns.every(
      (column) =>
        isRecord(column) &&
        typeof column.name === "string" &&
        typeof column.detected_type === "string" &&
        DETECTED_TYPES.has(column.detected_type) &&
        isNonNegativeInteger(column.null_count),
    ) ||
    !Array.isArray(value.rows) ||
    !value.rows.every(isRecord) ||
    !isNonNegativeInteger(value.total_rows) ||
    !isPositiveInteger(value.preview_limit) ||
    (value.warnings !== undefined &&
      (!Array.isArray(value.warnings) ||
        !value.warnings.every(
          (warning) =>
            isRecord(warning) &&
            typeof warning.code === "string" &&
            typeof warning.message === "string" &&
            (warning.columns === undefined ||
              (Array.isArray(warning.columns) &&
                warning.columns.every((column) => typeof column === "string"))),
        )))
  ) {
    return undefined;
  }

  return value as TransformationSourceStructure;
}
