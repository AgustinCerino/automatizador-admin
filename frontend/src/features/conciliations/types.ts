import type { components } from "@/types/generated/api";

export type ConciliationFile = Omit<
  components["schemas"]["ArchivoRead"],
  "checksum" | "ruta_storage"
>;
export type ConciliationFilePreview =
  components["schemas"]["ArchivoPreviewRead"];
export type ConciliationFileSelection =
  components["schemas"]["ConciliacionArchivosSelection"];
export type ConciliationMappingCreate =
  components["schemas"]["ConciliacionMappingCreate"];
export type ConciliationMapping =
  components["schemas"]["ConciliacionMappingRead"];
export type ConciliationSummary =
  components["schemas"]["ConciliacionResumenRead"];
export type ConciliationResult =
  components["schemas"]["ResultadoConciliacionRead"];
export type ConciliationRevisionUpdate =
  components["schemas"]["ResultadoRevisionUpdate"];
export type ConciliationRevisionSummary =
  components["schemas"]["RevisionResumenRead"];
