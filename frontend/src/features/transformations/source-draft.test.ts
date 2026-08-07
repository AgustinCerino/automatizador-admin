import { describe, expect, it } from "vitest";

import {
  createTransformationSourceDraftHref,
  readTransformationSourceDraft,
  resolveTransformationSourceDraft,
} from "@/features/transformations/source-draft";
import type { TransformationSummary } from "@/features/transformations/types";

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

describe("borrador URL del archivo fuente", () => {
  it("lee IDs válidos, conserva espacios de la hoja y usa fila 1 por defecto", () => {
    expect(readTransformationSourceDraft(new URLSearchParams("sourceFileId=8&sheet= Datos "))).toEqual({
      headerRow: 1,
      sheet: " Datos ",
      sourceFileId: 8,
    });
  });

  it("descarta enteros inválidos sin interpretar valores parciales", () => {
    expect(readTransformationSourceDraft(new URLSearchParams("sourceFileId=8x&headerRow=0"))).toEqual({
      headerRow: 1,
      sheet: null,
      sourceFileId: null,
    });
  });

  it("actualiza sólo los tres parámetros del borrador", () => {
    expect(
      createTransformationSourceDraftHref(
        "/transformaciones/31",
        new URLSearchParams("tab=detalle&sheet=Vieja"),
        { headerRow: 3, sheet: " Ventas ", sourceFileId: 8 },
      ),
    ).toBe("/transformaciones/31?tab=detalle&sheet=+Ventas+&sourceFileId=8&headerRow=3");
  });

  it("usa summary.source como autoridad cuando existe configuración", () => {
    expect(
      resolveTransformationSourceDraft(
        {
          ...SUMMARY,
          has_configuration: true,
          source: {
            archivo_id: 20,
            checksum: null,
            extension: ".xlsx",
            file_exists: true,
            header_row: 4,
            nombre_original: "configurado.xlsx",
            sheet_name: "Oficial",
          },
        },
        { headerRow: 1, sheet: "Draft", sourceFileId: 8 },
      ),
    ).toEqual({ headerRow: 4, sheet: "Oficial", sourceFileId: 20 });
  });
});
