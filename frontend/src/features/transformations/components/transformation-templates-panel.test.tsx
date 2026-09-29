import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useApplyTransformationTemplate,
  useCreateTransformationTemplate,
  useDeactivateTransformationTemplate,
  useTransformationTemplatesQuery,
  useUpdateTransformationTemplate,
} from "@/features/transformations/api/use-templates";
import { TransformationTemplatesPanel } from "@/features/transformations/components/transformation-templates-panel";
import type { TransformationSummary, TransformationTemplateRead } from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/features/transformations/api/use-templates", () => ({
  useApplyTransformationTemplate: vi.fn(),
  useCreateTransformationTemplate: vi.fn(),
  useDeactivateTransformationTemplate: vi.fn(),
  useTransformationTemplatesQuery: vi.fn(),
  useUpdateTransformationTemplate: vi.fn(),
}));

const queryMock = vi.mocked(useTransformationTemplatesQuery);
const createMock = vi.mocked(useCreateTransformationTemplate);
const applyMock = vi.mocked(useApplyTransformationTemplate);
const updateMock = vi.mocked(useUpdateTransformationTemplate);
const deactivateMock = vi.mocked(useDeactivateTransformationTemplate);

const TEMPLATE = {
  activo: true,
  configuracion: {
    output_columns: [{ operation: "CONSTANT", output_column: "Estado", output_type: "text", position: 1, required: false, value: "OK" }],
    rows: { filters: [], remove_duplicates: { by_output_columns: [], enabled: false, keep: "FIRST" }, sort_by: [] },
    source: { header_row: 1, sheet_name: "Datos" },
  },
  created_at: "2026-09-20T12:00:00Z",
  descripcion: "Configuración mensual",
  id: 9,
  nombre: "Mensual",
  proceso_id: 4,
  schema_version: 1,
  updated_at: "2026-09-21T12:00:00Z",
} satisfies TransformationTemplateRead;

const SUMMARY = {
  action_required: "VALIDATE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: true,
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CONFIGURADO",
  generation: { available: false, file_exists: false },
  has_configuration: true,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: { archivo_id: 8, checksum: null, extension: ".xlsx", file_exists: true, header_row: 2, nombre_original: "ventas.xlsx", sheet_name: "Datos" },
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

function mutation(mutateAsync = vi.fn()) {
  return { error: null, isPending: false, mutateAsync, reset: vi.fn() };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof TransformationTemplatesPanel>> = {}) {
  const onApplied = vi.fn();
  render(
    <TransformationTemplatesPanel
      canManage
      hasLocalChanges={false}
      onApplied={onApplied}
      source={{ fileId: 8, headerRow: 2, sheet: "Datos" }}
      summary={SUMMARY}
      {...overrides}
    />,
  );
  return { onApplied };
}

describe("TransformationTemplatesPanel", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => undefined;
  });

  beforeEach(() => {
    queryMock.mockReturnValue({ data: { items: [TEMPLATE], total: 1 }, isError: false, isPending: false, refetch: vi.fn() } as never);
    createMock.mockReturnValue(mutation() as never);
    applyMock.mockReturnValue(mutation() as never);
    updateMock.mockReturnValue(mutation() as never);
    deactivateMock.mockReturnValue(mutation() as never);
  });

  it("muestra el listado y la metadata útil", async () => {
    renderPanel();
    expect((await screen.findAllByText("Mensual")).length).toBeGreaterThan(0);
    expect(screen.getByText("Configuración mensual")).toBeInTheDocument();
    expect(screen.getByText(/Versión 1/)).toBeInTheDocument();
  });

  it("muestra un estado vacío", () => {
    queryMock.mockReturnValue({ data: { items: [], total: 0 }, isError: false, isPending: false, refetch: vi.fn() } as never);
    renderPanel();
    expect(screen.getByText("No hay plantillas activas disponibles para este proceso.")).toBeInTheDocument();
  });

  it("muestra loading y un error de carga recuperable", async () => {
    const refetch = vi.fn();
    queryMock.mockReturnValue({ isError: false, isPending: true, refetch } as never);
    const { rerender } = render(
      <TransformationTemplatesPanel canManage hasLocalChanges={false} onApplied={vi.fn()} source={{ fileId: 8, headerRow: 2, sheet: "Datos" }} summary={SUMMARY} />,
    );
    expect(screen.getByText("Cargando plantillas…")).toBeInTheDocument();
    queryMock.mockReturnValue({ error: new ApiError(503, { message: "interno" }), isError: true, isPending: false, refetch } as never);
    rerender(<TransformationTemplatesPanel canManage hasLocalChanges={false} onApplied={vi.fn()} source={{ fileId: 8, headerRow: 2, sheet: "Datos" }} summary={SUMMARY} />);
    expect(screen.getByText("No pudimos cargar las plantillas")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("guarda la configuración persistida como plantilla y previene doble envío", async () => {
    let resolveCreate: ((value: TransformationTemplateRead) => void) | undefined;
    const mutateAsync = vi.fn(() => new Promise<TransformationTemplateRead>((resolve) => { resolveCreate = resolve; }));
    createMock.mockReturnValue(mutation(mutateAsync) as never);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Guardar como plantilla" }));
    await user.type(screen.getByLabelText("Nombre"), "Trimestral");
    await user.type(screen.getByLabelText("Descripción (opcional)"), "Cierre");
    const submit = screen.getByRole("button", { name: "Guardar plantilla" });
    await user.click(submit);
    await user.click(submit);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ nombre: "Trimestral", descripcion: "Cierre" });
    resolveCreate?.({ ...TEMPLATE, id: 10, nombre: "Trimestral" });
  });

  it("confirma la pérdida de cambios locales y actualiza el constructor sólo tras éxito", async () => {
    const configuration = {
      configuracion: {
        output_columns: TEMPLATE.configuracion.output_columns,
        rows: TEMPLATE.configuracion.rows,
        source: { archivo_id: 8, header_row: 2, sheet_name: "Datos" },
      },
      ejecucion_id: 31,
      estado_ejecucion: "CONFIGURADO",
      updated_at: "2026-09-29T12:00:00Z",
    };
    const mutateAsync = vi.fn().mockResolvedValue(configuration);
    applyMock.mockReturnValue(mutation(mutateAsync) as never);
    const user = userEvent.setup();
    const { onApplied } = renderPanel({ hasLocalChanges: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar plantilla" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aplicar plantilla" }));
    expect(screen.getByText("Hay cambios locales sin guardar")).toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar aplicación" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      input: { archivo_id: 8, header_row: 2, sheet_name: "Datos" },
      templateId: 9,
    });
    expect(onApplied).toHaveBeenCalledWith(configuration);
    expect(screen.getByText(/Plantilla aplicada: Mensual/)).toBeInTheDocument();
  });

  it("muestra un error controlado sin aplicar parcialmente", async () => {
    applyMock.mockReturnValue({ ...mutation(), error: new ApiError(409, { message: "interno" }) } as never);
    const { onApplied } = renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar plantilla" })).toBeEnabled());
    await userEvent.setup().click(screen.getByRole("button", { name: "Aplicar plantilla" }));
    expect(screen.getByText(/entra en conflicto con el estado actual/)).toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("expone edición y desactivación sólo para administradores", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TransformationTemplatesPanel canManage={false} hasLocalChanges={false} onApplied={vi.fn()} source={{ fileId: 8, headerRow: 2, sheet: "Datos" }} summary={SUMMARY} />,
    );
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    rerender(<TransformationTemplatesPanel canManage hasLocalChanges={false} onApplied={vi.fn()} source={{ fileId: 8, headerRow: 2, sheet: "Datos" }} summary={SUMMARY} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar plantilla" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(screen.getByText(/No se eliminará físicamente/)).toBeInTheDocument();
  });
});
