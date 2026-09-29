import type { components } from "@/types/generated/api";

export type TransformationSummary =
  components["schemas"]["TransformacionExcelOperationalSummaryRead"];
export type TransformationSource =
  components["schemas"]["TransformacionExcelSourceOperationalRead"];
export type TransformationTemplate =
  components["schemas"]["TransformacionExcelTemplateOperationalRead"];
export type TransformationValidation =
  components["schemas"]["TransformacionExcelValidationOperationalRead"];
export type TransformationGeneration =
  components["schemas"]["TransformacionExcelGenerationOperationalRead"];
export type TransformationIssue =
  components["schemas"]["TransformacionExcelOperationalIssueRead"];
export type TransformationSourceFile = Omit<
  components["schemas"]["ArchivoRead"],
  "checksum" | "ruta_storage"
>;
export type TransformationSourceStructure =
  components["schemas"]["TransformacionExcelStructureRead"];
export type TransformationSourceColumn =
  components["schemas"]["TransformacionExcelColumnInspectionRead"];
export type TransformationSourceWarning =
  components["schemas"]["TransformacionExcelInspectionWarningRead"];
export type TransformationAction = TransformationSummary["action_required"];
export type TransformationExcelConfig =
  components["schemas"]["TransformacionExcelConfig"];
export type TransformationExcelConfigRead =
  components["schemas"]["TransformacionExcelConfigRead"];
export type TransformationValidationRead =
  components["schemas"]["TransformacionExcelValidationRead"];
export type TransformationGenerationRead =
  components["schemas"]["TransformacionExcelGenerationRead"];
export type TransformationValidationIssue =
  components["schemas"]["TransformacionExcelValidationIssueRead"];
export type TransformationTemplateRead =
  components["schemas"]["TransformacionExcelTemplateRead"];
export type TransformationTemplateListRead =
  components["schemas"]["TransformacionExcelTemplateListRead"];
export type TransformationTemplateCreate =
  components["schemas"]["TransformacionExcelTemplateCreate"];
export type TransformationTemplateUpdate =
  components["schemas"]["TransformacionExcelTemplateUpdate"];
export type TransformationTemplateApply =
  components["schemas"]["TransformacionExcelTemplateApply"];

export interface TransformationCapabilities {
  canDownload: boolean;
  canEditConfiguration: boolean;
  canGenerate: boolean;
  canValidate: boolean;
}

export function getTransformationCapabilities(
  summary: TransformationSummary,
): TransformationCapabilities {
  return {
    canDownload: summary.can_download,
    canEditConfiguration: summary.can_edit_configuration,
    canGenerate: summary.can_generate,
    canValidate: summary.can_validate,
  };
}
