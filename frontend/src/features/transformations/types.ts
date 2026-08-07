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
export type TransformationAction = TransformationSummary["action_required"];

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
