import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  GenerationSummaryCard,
  OperationalIssues,
  SourceSummaryCard,
  ValidationSummaryCard,
} from "@/features/transformations/components/workspace-sections";
import type { TransformationSummary } from "@/features/transformations/types";

const SUMMARY = {
  action_required: "FIX_ERRORS",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: true,
  ejecucion_id: 31,
  errors_count: 2,
  estado_ejecucion: "CONFIGURADO",
  generation: { available: false, file_exists: false },
  has_configuration: true,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

const SOURCE = {
  archivo_id: 8,
  checksum: "1234567890abcdefXYZ9876",
  extension: ".xlsx",
  file_exists: true,
  header_row: 1,
  nombre_original: "origen.xlsx",
  sheet_name: "Datos",
};

describe("SourceSummaryCard", () => {
  it("muestra ausencia de archivo", () => {
    render(<SourceSummaryCard source={null} />);
    expect(screen.getByText("Sin archivo")).toBeInTheDocument();
  });

  it("muestra campos del archivo existente", () => {
    render(<SourceSummaryCard source={SOURCE} />);
    expect(screen.getAllByText("origen.xlsx").length).toBeGreaterThan(0);
    expect(screen.getByText("12345678…9876")).toBeInTheDocument();
  });

  it("alerta cuando falta el archivo físico", () => {
    render(<SourceSummaryCard source={{ ...SOURCE, file_exists: false }} />);
    expect(screen.getByText("El archivo fuente ya no está disponible.")).toBeInTheDocument();
  });
});

describe("ValidationSummaryCard", () => {
  it("muestra validación pendiente", () => {
    render(<ValidationSummaryCard validation={{ available: false }} />);
    expect(screen.getByText("Pendiente de validación.")).toBeInTheDocument();
  });

  it("muestra una validación válida con métricas", () => {
    render(
      <ValidationSummaryCard
        validation={{ available: true, filas_validas: 1200, valid: true }}
      />,
    );
    expect(screen.getAllByText("Validación correcta").length).toBeGreaterThan(0);
    expect(screen.getByText("1.200")).toBeInTheDocument();
  });

  it("muestra una validación inválida", () => {
    render(<ValidationSummaryCard validation={{ available: true, valid: false }} />);
    expect(screen.getAllByText("Validación con errores").length).toBeGreaterThan(0);
  });
});

describe("GenerationSummaryCard", () => {
  it("muestra resultado pendiente", () => {
    render(<GenerationSummaryCard generation={{ available: false, file_exists: false }} />);
    expect(screen.getByText("Todavía no se generó un archivo de salida.")).toBeInTheDocument();
  });

  it("muestra resultado disponible sin listar todas las columnas", () => {
    render(
      <GenerationSummaryCard
        generation={{
          available: true,
          columnas_salida: ["A", "B", "C"],
          file_exists: true,
          nombre_archivo: "resultado.xlsx",
          size_bytes: 1536,
          total_filas: 40,
        }}
      />,
    );
    expect(screen.getAllByText("resultado.xlsx").length).toBeGreaterThan(0);
    expect(screen.getByText("3 columnas")).toBeInTheDocument();
    expect(screen.getByText("1,5 KB")).toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("alerta cuando falta el resultado físico", () => {
    render(
      <GenerationSummaryCard generation={{ available: true, file_exists: false }} />,
    );
    expect(screen.getByText("El archivo generado ya no está disponible.")).toBeInTheDocument();
  });
});

describe("OperationalIssues", () => {
  it("muestra el estado sin problemas", () => {
    render(<OperationalIssues summary={SUMMARY} />);
    expect(screen.getByText("Sin problemas detectados")).toBeInTheDocument();
  });

  it("ordena errores antes de advertencias y representa muestras seguras", () => {
    render(
      <OperationalIssues
        summary={{
          ...SUMMARY,
          errors_count: 2,
          issues: [
            {
              blocking: false,
              code: "WARN_CODE",
              count: 1,
              message: "Advertencia de prueba",
              origin: "VALIDATION",
              severity: "WARNING",
            },
            {
              blocking: true,
              code: "ERROR_CODE",
              count: 2,
              message: "Error de prueba",
              origin: "VALIDATION",
              sample_rows: [{ fila: 3, detalle: { interno: true } }],
              severity: "ERROR",
            },
          ],
          warnings_count: 1,
        }}
      />,
    );

    const messages = screen.getAllByText(/de prueba/);
    expect(messages[0]).toHaveTextContent("Error de prueba");
    expect(screen.getByText("Dato complejo")).toBeInTheDocument();
    expect(screen.getByText("2 errores")).toBeInTheDocument();
    expect(screen.getByText("1 advertencias")).toBeInTheDocument();
  });
});
