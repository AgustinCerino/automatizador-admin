import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useTransformationSourceFilesQuery,
  useTransformationSourceStructureQuery,
  useUploadTransformationSourceFile,
} from "@/features/transformations/api/use-source-files";
import { SourceFilePanel } from "@/features/transformations/components/source-file-panel";
import type { TransformationSummary } from "@/features/transformations/types";

const replace = vi.fn();
let query = "sourceFileId=8&sheet=Datos&headerRow=2";

vi.mock("next/navigation", () => ({
  usePathname: () => "/transformaciones/31",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/features/transformations/api/use-source-files", () => ({
  useTransformationSourceFilesQuery: vi.fn(),
  useTransformationSourceStructureQuery: vi.fn(),
  useUploadTransformationSourceFile: vi.fn(),
}));

const filesQueryMock = vi.mocked(useTransformationSourceFilesQuery);
const structureQueryMock = vi.mocked(useTransformationSourceStructureQuery);
const uploadMock = vi.mocked(useUploadTransformationSourceFile);

const SUMMARY = {
  action_required: "CONFIGURE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: false,
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CARGADO",
  generation: { available: false, file_exists: false },
  has_configuration: false,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

const FILE = {
  ejecucion_id: 31,
  extension: ".xlsx",
  id: 8,
  mime_type: "application/xlsx",
  nombre_original: "origen.xlsx",
  size_bytes: 1536,
  tipo_archivo: "FUENTE",
  uploaded_at: "2026-08-07T12:00:00Z",
};

describe("SourceFilePanel", () => {
  beforeEach(() => {
    query = "sourceFileId=8&sheet=Datos&headerRow=2";
    replace.mockReset();
    filesQueryMock.mockReturnValue({ data: [FILE], isPending: false } as never);
    structureQueryMock.mockReturnValue({
      data: {
        archivo_id: 8,
        available_sheets: ["Datos"],
        columns: [{ detected_type: "integer", name: "Cantidad", null_count: 1 }],
        extension: ".xlsx",
        header_row: 2,
        nombre_original: "origen.xlsx",
        preview_limit: 20,
        rows: [{ Cantidad: 4 }],
        selected_sheet_name: "Datos",
        total_rows: 1,
        warnings: [{ code: "EMPTY_VALUES", columns: ["Cantidad"], message: "Hay vacíos" }],
      },
      isFetching: false,
      isPending: false,
    } as never);
    uploadMock.mockReturnValue({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it("muestra carga, archivo elegido, columnas, advertencias y vista previa", () => {
    render(<SourceFilePanel summary={SUMMARY} />);
    expect(screen.getByRole("button", { name: /cargar archivo/i })).toBeInTheDocument();
    expect(screen.getAllByText("origen.xlsx").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Columnas detectadas" })).toBeInTheDocument();
    expect(screen.getByText("Hay vacíos")).toBeInTheDocument();
    expect(screen.getByText("Entero")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("usa la fuente configurada en modo de sólo lectura", () => {
    query = "sourceFileId=999&sheet=Borrador&headerRow=1";
    render(
      <SourceFilePanel
        summary={{
          ...SUMMARY,
          has_configuration: true,
          source: {
            archivo_id: 8,
            checksum: null,
            extension: ".xlsx",
            file_exists: true,
            header_row: 2,
            nombre_original: "origen.xlsx",
            sheet_name: "Datos",
          },
        }}
      />,
    );
    expect(screen.getByText("Fuente definida por la configuración guardada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar archivo/i })).not.toBeInTheDocument();
    expect(structureQueryMock).toHaveBeenLastCalledWith({
      executionId: 31,
      fileId: 8,
      headerRow: 2,
      sheet: "Datos",
    });
  });
});
