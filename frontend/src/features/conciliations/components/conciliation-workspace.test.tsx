import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useConciliationFilesQuery,
  useConciliationMappingQuery,
  useConciliationPreviewQuery,
  useConciliationSelectionQuery,
  useSaveConciliationMapping,
  useSaveConciliationSelection,
} from "@/features/conciliations/api/use-conciliation-files";
import { ConciliationWorkspace } from "@/features/conciliations/components/conciliation-workspace";
import { useExecutionQuery } from "@/features/executions/api/use-execution-query";
import { useProcessQuery } from "@/features/processes/api/use-process-query";

vi.mock("@/features/executions/api/use-execution-query", () => ({
  useExecutionQuery: vi.fn(),
}));
vi.mock("@/features/processes/api/use-process-query", () => ({
  useProcessQuery: vi.fn(),
}));
vi.mock("@/features/conciliations/api/use-conciliation-files", () => ({
  useConciliationFilesQuery: vi.fn(),
  useConciliationMappingQuery: vi.fn(),
  useConciliationPreviewQuery: vi.fn(),
  useConciliationSelectionQuery: vi.fn(),
  useSaveConciliationMapping: vi.fn(),
  useSaveConciliationSelection: vi.fn(),
}));
vi.mock("@/features/conciliations/components/conciliation-mapping-editor", () => ({
  ConciliationMappingEditor: () => <section aria-label="Mapping" />,
}));
vi.mock("@/features/conciliations/components/conciliation-file-slot", () => ({
  ConciliationFileSlot: ({ onSelect, role, selectedId }: {
    onSelect: (id: number) => void;
    role: "A" | "B";
    selectedId: number | null;
  }) => (
    <section aria-label={`Slot ${role}`}>
      <p>{`Seleccionado ${role}: ${selectedId ?? "ninguno"}`}</p>
      <button onClick={() => onSelect(role === "A" ? 3 : 2)} type="button">
        {`Cambiar ${role}`}
      </button>
    </section>
  ),
}));

const useExecutionMock = vi.mocked(useExecutionQuery);
const useProcessMock = vi.mocked(useProcessQuery);
const useFilesMock = vi.mocked(useConciliationFilesQuery);
const useMappingMock = vi.mocked(useConciliationMappingQuery);
const usePreviewMock = vi.mocked(useConciliationPreviewQuery);
const useSelectionMock = vi.mocked(useConciliationSelectionQuery);
const useSaveMappingMock = vi.mocked(useSaveConciliationMapping);
const useSaveMock = vi.mocked(useSaveConciliationSelection);

const EXECUTION = {
  created_at: "2026-08-21T12:00:00Z",
  error_message: null,
  estado: "CARGADO",
  finished_at: null,
  id: 31,
  proceso_id: 4,
  resumen_json: null,
  started_at: "2026-08-21T12:00:00Z",
  usuario_id: 12,
};
const PROCESS = {
  cliente_id: 7,
  created_at: "2026-08-21T12:00:00Z",
  descripcion: null,
  estado: "ACTIVO",
  id: 4,
  nombre: "Conciliación bancaria",
  tipo: "CONCILIACION_EXCEL",
  updated_at: null,
};
const FILES = [1, 2, 3].map((id) => ({
  ejecucion_id: 31,
  extension: ".csv",
  id,
  mime_type: "text/csv",
  nombre_original: `archivo-${id}.csv`,
  size_bytes: 100,
  tipo_archivo: "ENTRADA_CONCILIACION",
  uploaded_at: "2026-08-21T12:00:00Z",
}));

describe("ConciliationWorkspace", () => {
  let selection: { archivo_a_id: number; archivo_b_id: number } | null;
  let mutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selection = { archivo_a_id: 1, archivo_b_id: 2 };
    mutateAsync = vi.fn(async (nextSelection) => {
      selection = nextSelection;
      return nextSelection;
    });
    useExecutionMock.mockReturnValue({ data: EXECUTION, isPending: false } as never);
    useProcessMock.mockReturnValue({ data: PROCESS, isPending: false } as never);
    useFilesMock.mockReturnValue({ data: FILES, isPending: false } as never);
    useMappingMock.mockReturnValue({ data: null, isPending: false } as never);
    usePreviewMock.mockReturnValue({ data: { columns: ["Factura", "Importe"] } } as never);
    useSelectionMock.mockImplementation(() => ({
      data: selection,
      isPending: false,
      isSuccess: true,
    } as never));
    useSaveMock.mockImplementation(() => ({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutateAsync,
    } as never));
    useSaveMappingMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it("renderiza el workspace correcto y recupera A/B persistidos", async () => {
    render(<ConciliationWorkspace executionId={31} />);
    expect(screen.getByRole("heading", { name: "Conciliación Excel" })).toBeInTheDocument();
    expect(await screen.findByText("Seleccionado A: 1")).toBeInTheDocument();
    expect(screen.getByText("Seleccionado B: 2")).toBeInTheDocument();
    expect(screen.getByText("Selección sincronizada")).toBeInTheDocument();
    expect(screen.getByText("archivo-3.csv")).toBeInTheDocument();
  });

  it("representa el estado vacío sin inventar roles", async () => {
    selection = null;
    useFilesMock.mockReturnValue({ data: [], isPending: false } as never);
    render(<ConciliationWorkspace executionId={31} />);
    expect(screen.getByText(/Todavía no hay archivos CSV o Excel/)).toBeInTheDocument();
    expect(await screen.findByText("Seleccionado A: ninguno")).toBeInTheDocument();
    expect(screen.getByText("Seleccionado B: ninguno")).toBeInTheDocument();
  });

  it("mantiene B, marca dirty y aplica la respuesta persistida al cambiar A", async () => {
    render(<ConciliationWorkspace executionId={31} />);
    await screen.findByText("Seleccionado A: 1");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar A" }));

    expect(screen.getByText("Seleccionado A: 3")).toBeInTheDocument();
    expect(screen.getByText("Seleccionado B: 2")).toBeInTheDocument();
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar selección" }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ archivo_a_id: 3, archivo_b_id: 2 });
      expect(screen.getByText("Selección sincronizada")).toBeInTheDocument();
    });
  });

  it("no usa este workspace para Transformación Excel", () => {
    useProcessMock.mockReturnValue({
      data: { ...PROCESS, tipo: "TRANSFORMACION_EXCEL" },
      isPending: false,
    } as never);
    render(<ConciliationWorkspace executionId={31} />);
    expect(screen.getByRole("heading", { name: "Workspace no disponible" })).toBeInTheDocument();
    expect(screen.queryByText("Archivos disponibles")).not.toBeInTheDocument();
  });
});
