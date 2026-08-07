import type { ExecutionRead } from "@/features/executions/types";
import type { ProcessRead } from "@/features/processes/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
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
