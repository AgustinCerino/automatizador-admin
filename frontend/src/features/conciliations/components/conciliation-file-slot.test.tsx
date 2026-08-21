import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useConciliationPreviewQuery,
  useUploadConciliationFile,
} from "@/features/conciliations/api/use-conciliation-files";
import { ConciliationFileSlot } from "@/features/conciliations/components/conciliation-file-slot";
import { ConciliationFilePreviewTable } from "@/features/conciliations/components/conciliation-file-preview";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/features/conciliations/api/use-conciliation-files", () => ({
  useConciliationPreviewQuery: vi.fn(),
  useUploadConciliationFile: vi.fn(),
}));

const usePreviewMock = vi.mocked(useConciliationPreviewQuery);
const useUploadMock = vi.mocked(useUploadConciliationFile);
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
const PREVIEW = {
  archivo_id: 1,
  columns: ["Factura", "Total"],
  extension: ".csv",
  nombre_original: "archivo-1.csv",
  preview_limit: 20,
  rows: [{ Factura: "F-1", Total: 12 }],
  total_rows: 1,
};

describe("ConciliationFileSlot", () => {
  let mutateAsync: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue(FILES[2]);
    useUploadMock.mockReturnValue({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutateAsync,
    } as never);
    usePreviewMock.mockReturnValue({ data: PREVIEW, isPending: false } as never);
  });

  it("deshabilita en A el archivo ya elegido para B", async () => {
    const user = userEvent.setup();
    render(
      <ConciliationFileSlot
        executionId={31}
        files={FILES}
        onSelect={vi.fn()}
        otherSelectedId={2}
        role="A"
        selectedId={1}
      />,
    );
    await user.click(screen.getByLabelText("Archivo seleccionado para A"));
    expect(screen.getByRole("option", { name: "archivo-2.csv" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("carga un archivo y lo deja como borrador del slot", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ConciliationFileSlot
        executionId={31}
        files={FILES}
        onSelect={onSelect}
        otherSelectedId={2}
        role="A"
        selectedId={1}
      />,
    );
    const file = new File(["x,y\n1,2"], "nuevo.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Cargar archivo para el slot A"), file);
    await user.click(screen.getByRole("button", { name: "Cargar para Archivo A" }));
    expect(mutateAsync).toHaveBeenCalledWith(file);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("muestra un error de upload sin perder el slot", () => {
    useUploadMock.mockReturnValue({
      error: new ApiError(422, { message: "Inválido" }),
      isError: true,
      isPending: false,
      isSuccess: false,
      mutateAsync,
    } as never);
    render(
      <ConciliationFileSlot
        executionId={31}
        files={FILES}
        onSelect={vi.fn()}
        otherSelectedId={2}
        role="A"
        selectedId={1}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El archivo debe ser CSV, XLS o XLSX.",
    );
    expect(screen.getByRole("heading", { name: "Preview A" })).toBeInTheDocument();
  });

  it("aísla un error de Preview A de un Preview B disponible", () => {
    usePreviewMock.mockImplementation((_executionId, fileId) => (
      fileId === 1
        ? {
            error: new ApiError(400, { message: "Inválido" }),
            isError: true,
            isPending: false,
            refetch: vi.fn(),
          }
        : {
            data: { ...PREVIEW, archivo_id: 2, columns: ["Proveedor"], rows: [{ Proveedor: "ACME" }] },
            isPending: false,
          }
    ) as never);
    render(
      <div>
        <ConciliationFileSlot executionId={31} files={FILES} onSelect={vi.fn()} otherSelectedId={2} role="A" selectedId={1} />
        <ConciliationFileSlot executionId={31} files={FILES} onSelect={vi.fn()} otherSelectedId={1} role="B" selectedId={2} />
      </div>,
    );
    expect(screen.getByRole("heading", { name: "Preview A no disponible" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Proveedor" })).toBeInTheDocument();
  });
});

describe("ConciliationFilePreviewTable", () => {
  it("admite columnas distintas y preview vacío", () => {
    const { rerender } = render(
      <ConciliationFilePreviewTable preview={PREVIEW} role="A" />,
    );
    expect(screen.getByRole("columnheader", { name: "Factura" })).toBeInTheDocument();
    expect(screen.getByText("F-1")).toBeInTheDocument();

    rerender(
      <ConciliationFilePreviewTable
        preview={{ ...PREVIEW, columns: ["Proveedor"], rows: [] }}
        role="B"
      />,
    );
    expect(screen.getByText("El archivo B no contiene filas para mostrar.")).toBeInTheDocument();
  });
});
