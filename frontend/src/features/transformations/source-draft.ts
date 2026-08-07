import type { TransformationSummary } from "@/features/transformations/types";

export interface TransformationSourceDraft {
  headerRow: number;
  sheet: string | null;
  sourceFileId: number | null;
}

interface SearchParamsReader {
  get(name: string): string | null;
  toString(): string;
}

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function readTransformationSourceDraft(
  searchParams: SearchParamsReader,
): TransformationSourceDraft {
  return {
    headerRow: parsePositiveInteger(searchParams.get("headerRow")) ?? 1,
    sheet: searchParams.get("sheet"),
    sourceFileId: parsePositiveInteger(searchParams.get("sourceFileId")),
  };
}

export function resolveTransformationSourceDraft(
  summary: TransformationSummary,
  draft: TransformationSourceDraft,
): TransformationSourceDraft {
  if (summary.has_configuration && summary.source) {
    return {
      headerRow: summary.source.header_row,
      sheet: summary.source.sheet_name,
      sourceFileId: summary.source.archivo_id,
    };
  }
  return draft;
}

export function createTransformationSourceDraftHref(
  pathname: string,
  current: SearchParamsReader,
  draft: TransformationSourceDraft,
): string {
  const params = new URLSearchParams(current.toString());
  if (draft.sourceFileId === null) params.delete("sourceFileId");
  else params.set("sourceFileId", String(draft.sourceFileId));
  if (draft.sheet === null) params.delete("sheet");
  else params.set("sheet", draft.sheet);
  params.set("headerRow", String(draft.headerRow));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
