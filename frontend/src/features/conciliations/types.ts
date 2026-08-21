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
