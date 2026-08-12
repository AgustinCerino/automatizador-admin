"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveTransformationConfiguration, useTransformationConfigurationQuery } from "@/features/transformations/api/use-configuration";
import { useTransformationSourceStructureQuery } from "@/features/transformations/api/use-source-files";
import { EMPTY_ROWS, type DraftRows, RowRulesEditor } from "@/features/transformations/components/row-rules-editor";
import { readTransformationSourceDraft, resolveTransformationSourceDraft } from "@/features/transformations/source-draft";
import type { TransformationExcelConfig, TransformationSummary } from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";

type Operation = "SOURCE" | "CONSTANT" | "CONCAT" | "ARITHMETIC" | "VALUE_MAP";
type OperandType = "SOURCE" | "CONSTANT";
type ConcatPartType = "SOURCE" | "LITERAL";
type ArithmeticOperator = "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE";
type UnmappedPolicy = "ERROR" | "KEEP_ORIGINAL" | "USE_DEFAULT";

interface DraftConcatPart { id: number; type: ConcatPartType; value: string }
interface DraftOperand { type: OperandType; value: string }
interface DraftMapping { id: number; key: string; value: string }
interface DraftColumn {
  id: number; operation: Operation; outputColumn: string; sourceColumn: string; value: string;
  concatParts: DraftConcatPart[]; operator: ArithmeticOperator; leftOperand: DraftOperand;
  rightOperand: DraftOperand; mapping: DraftMapping[]; unmappedPolicy: UnmappedPolicy; defaultValue: string;
}

const OPERATIONS: Operation[] = ["SOURCE", "CONSTANT", "CONCAT", "ARITHMETIC", "VALUE_MAP"];
const ARITHMETIC_OPERATORS: ArithmeticOperator[] = ["ADD", "SUBTRACT", "MULTIPLY", "DIVIDE"];
const UNMAPPED_POLICIES: UnmappedPolicy[] = ["ERROR", "KEEP_ORIGINAL", "USE_DEFAULT"];

function emptyColumn(id: number): DraftColumn {
  return {
    id, operation: "SOURCE", outputColumn: "", sourceColumn: "", value: "", concatParts: [],
    operator: "ADD", leftOperand: { type: "SOURCE", value: "" }, rightOperand: { type: "CONSTANT", value: "" },
    mapping: [], unmappedPolicy: "ERROR", defaultValue: "",
  };
}

function draftColumnsFromConfiguration(configuration: TransformationExcelConfig): DraftColumn[] {
  return configuration.output_columns.map((column, index) => {
    const draft = emptyColumn(index + 1);
    draft.operation = column.operation;
    draft.outputColumn = column.output_column;
    if (column.operation === "SOURCE") draft.sourceColumn = column.source_column;
    if (column.operation === "CONSTANT") draft.value = column.value === null ? "" : String(column.value);
    if (column.operation === "CONCAT") draft.concatParts = column.parts?.map((part, partIndex) => ({ id: partIndex + 1, type: part.type, value: part.value })) ?? [];
    if (column.operation === "ARITHMETIC") {
      draft.operator = column.operator;
      draft.leftOperand = { type: column.left_operand.type, value: String(column.left_operand.value) };
      draft.rightOperand = { type: column.right_operand.type, value: String(column.right_operand.value) };
    }
    if (column.operation === "VALUE_MAP") {
      draft.sourceColumn = column.source_column;
      draft.mapping = Object.entries(column.mapping).map(([key, value], mappingIndex) => ({ id: mappingIndex + 1, key, value: String(value) }));
      draft.unmappedPolicy = column.unmapped_policy;
      draft.defaultValue = column.default_value === null || column.default_value === undefined ? "" : String(column.default_value);
    }
    return draft;
  });
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos guardar la configuraci\u00f3n.";
  if (error.status === 409) return "La configuraci\u00f3n no puede editarse en el estado actual.";
  if (error.status === 422) return "Revis\u00e1 los datos de las columnas antes de guardar.";
  if (error.status === 503) return "El servidor no est\u00e1 disponible.";
  return "No pudimos guardar la configuraci\u00f3n.";
}

function validColumn(column: DraftColumn): boolean {
  if (!column.outputColumn.trim()) return false;
  if (column.operation === "SOURCE") return Boolean(column.sourceColumn);
  if (column.operation === "CONSTANT") return column.value.trim() !== "";
  if (column.operation === "CONCAT") return column.concatParts.length > 0 && column.concatParts.every((part) => part.value.trim() !== "");
  if (column.operation === "ARITHMETIC") return [column.leftOperand, column.rightOperand].every((operand) => operand.value.trim() !== "" && (operand.type === "SOURCE" || Number.isFinite(Number(operand.value))));
  return Boolean(column.sourceColumn) && column.mapping.length > 0 && column.mapping.every((mapping) => mapping.key.trim() !== "" && mapping.value.trim() !== "");
}

function serializeArithmeticOperand(operand: DraftOperand) {
  return operand.type === "SOURCE"
    ? { type: "SOURCE" as const, value: operand.value }
    : { type: "CONSTANT" as const, value: Number(operand.value) };
}

function draftRowsFromConfiguration(configuration: TransformationExcelConfig): DraftRows {
  const persistedRows = configuration.rows;
  if (!persistedRows) return EMPTY_ROWS;
  return {
    filters: (persistedRows.filters ?? []).map((filter, index) => ({ id: index + 1, sourceColumn: filter.source_column, operator: filter.operator, value: filter.value === null || filter.value === undefined ? "" : String(filter.value), values: filter.values?.map(String).join(", ") ?? "" })),
    removeDuplicates: { enabled: persistedRows.remove_duplicates?.enabled ?? false, byOutputColumns: persistedRows.remove_duplicates?.by_output_columns ?? [] },
    sortBy: (persistedRows.sort_by ?? []).map((rule, index) => ({ id: index + 1, outputColumn: rule.output_column, direction: rule.direction })),
  };
}

function validRows(rows: DraftRows, sourceColumns: string[], outputColumns: string[]): boolean {
  const validFilters = rows.filters.length <= 5 && rows.filters.every((filter) => sourceColumns.includes(filter.sourceColumn) && (["NOT_EMPTY", "IS_EMPTY"].includes(filter.operator) || (filter.operator === "IN" ? filter.values.split(",").some((value) => value.trim()) : filter.value.trim() !== "")));
  const validDuplicates = !rows.removeDuplicates.enabled || rows.removeDuplicates.byOutputColumns.length > 0 && rows.removeDuplicates.byOutputColumns.every((column) => outputColumns.includes(column));
  const validSort = rows.sortBy.length <= 3 && rows.sortBy.every((rule) => outputColumns.includes(rule.outputColumn));
  return validFilters && validDuplicates && validSort;
}

export function TransformationConfigurationBuilder({ summary }: { summary: TransformationSummary }) {
  const searchParams = useSearchParams();
  const sourceDraft = useMemo(() => resolveTransformationSourceDraft(summary, readTransformationSourceDraft(searchParams ?? new URLSearchParams())), [searchParams, summary]);
  const configurationQuery = useTransformationConfigurationQuery(summary.ejecucion_id, summary.has_configuration);
  const persistedConfiguration = configurationQuery.data?.configuracion;
  const structureQuery = useTransformationSourceStructureQuery({ executionId: summary.ejecucion_id, fileId: sourceDraft.sourceFileId, headerRow: sourceDraft.headerRow, sheet: sourceDraft.sheet });
  const saveMutation = useSaveTransformationConfiguration(summary.ejecucion_id);
  const [columns, setColumns] = useState<DraftColumn[]>(() => [emptyColumn(1)]);
  const [rows, setRows] = useState<DraftRows>(EMPTY_ROWS);
  const [nextId, setNextId] = useState(2);
  const initializedConfiguration = useRef<TransformationExcelConfig | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!persistedConfiguration || initializedConfiguration.current === persistedConfiguration) return;
    initializedConfiguration.current = persistedConfiguration;
    const initialColumns = draftColumnsFromConfiguration(persistedConfiguration);
    queueMicrotask(() => { setColumns(initialColumns); setRows(draftRowsFromConfiguration(persistedConfiguration)); setNextId(initialColumns.length + 1); });
  }, [persistedConfiguration]);

  const sourceColumns = structureQuery.data?.columns.map((column) => column.name) ?? [];
  const outputColumns = columns.map((column) => column.outputColumn.trim()).filter(Boolean);
  const canEdit = summary.can_edit_configuration && (!summary.has_configuration || configurationQuery.isSuccess);
  const updateColumn = (id: number, update: Partial<DraftColumn>) => { setColumns((current) => current.map((column) => column.id === id ? { ...column, ...update } : column)); setValidationMessage(null); };
  const changeOperation = (id: number, operation: Operation) => updateColumn(id, { ...emptyColumn(id), operation, outputColumn: columns.find((column) => column.id === id)?.outputColumn ?? "" });
  const updateConcatPart = (column: DraftColumn, partId: number, update: Partial<DraftConcatPart>) => updateColumn(column.id, { concatParts: column.concatParts.map((part) => part.id === partId ? { ...part, ...update } : part) });
  const updateOperand = (column: DraftColumn, side: "leftOperand" | "rightOperand", update: Partial<DraftOperand>) => updateColumn(column.id, { [side]: { ...column[side], ...update } });
  const updateMapping = (column: DraftColumn, mappingId: number, update: Partial<DraftMapping>) => updateColumn(column.id, { mapping: column.mapping.map((mapping) => mapping.id === mappingId ? { ...mapping, ...update } : mapping) });

  async function save() {
    if (!sourceDraft.sourceFileId) return setValidationMessage("Seleccion\u00e1 un archivo fuente antes de guardar.");
    if (!columns.length) return setValidationMessage("Agreg\u00e1 al menos una columna de salida.");
    if (columns.some((column) => !validColumn(column)) || !validRows(rows, sourceColumns, outputColumns)) return setValidationMessage("Complet\u00e1 las columnas y reglas de filas antes de guardar.");
    const source = persistedConfiguration?.source ?? { archivo_id: sourceDraft.sourceFileId, header_row: sourceDraft.headerRow, sheet_name: sourceDraft.sheet };
    const configuration: TransformationExcelConfig = {
      ...(persistedConfiguration?.output ? { output: persistedConfiguration.output } : {}),
      output_columns: columns.map((column, index) => {
        const base = { output_column: column.outputColumn.trim(), position: index + 1, required: false };
        if (column.operation === "SOURCE") return { ...base, operation: "SOURCE" as const, output_type: "text" as const, source_column: column.sourceColumn };
        if (column.operation === "CONSTANT") return { ...base, operation: "CONSTANT" as const, output_type: "text" as const, value: column.value };
        if (column.operation === "CONCAT") return { ...base, operation: "CONCAT" as const, output_type: "text" as const, parts: column.concatParts.map(({ type, value }) => ({ type, value })) };
        if (column.operation === "ARITHMETIC") return { ...base, operation: "ARITHMETIC" as const, operator: column.operator, output_type: "decimal" as const, decimal_places: 2, left_operand: serializeArithmeticOperand(column.leftOperand), right_operand: serializeArithmeticOperand(column.rightOperand) };
        return { ...base, operation: "VALUE_MAP" as const, output_type: "text" as const, source_column: column.sourceColumn, mapping: Object.fromEntries(column.mapping.map((mapping) => [mapping.key, mapping.value])), unmapped_policy: column.unmappedPolicy, ...(column.unmappedPolicy === "USE_DEFAULT" ? { default_value: column.defaultValue } : {}) };
      }),
      rows: {
        filters: rows.filters.map((filter) => filter.operator === "IN" ? { source_column: filter.sourceColumn, operator: filter.operator, values: filter.values.split(",").map((value) => value.trim()).filter(Boolean) } : ["NOT_EMPTY", "IS_EMPTY"].includes(filter.operator) ? { source_column: filter.sourceColumn, operator: filter.operator } : { source_column: filter.sourceColumn, operator: filter.operator, value: filter.value }),
        remove_duplicates: { enabled: rows.removeDuplicates.enabled, by_output_columns: rows.removeDuplicates.enabled ? rows.removeDuplicates.byOutputColumns : [], keep: "FIRST" },
        sort_by: rows.sortBy.map((rule) => ({ output_column: rule.outputColumn, direction: rule.direction })),
      }, source,
    };
    setValidationMessage(null);
    try { await saveMutation.mutateAsync(configuration); } catch { /* rendered below */ }
  }

  return <Card><CardHeader><CardTitle><h2>Columnas de salida</h2></CardTitle><CardDescription>DefinÃ­ las columnas del archivo resultante a partir de la fuente inspeccionada.</CardDescription></CardHeader><CardContent className="space-y-5">
    {configurationQuery.isPending && summary.has_configuration ? <p className="text-sm text-muted-foreground">Cargando configuraciÃ³n guardadaâ€¦</p> : null}
    {configurationQuery.isError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>No pudimos cargar la configuraciÃ³n</AlertTitle><AlertDescription>La configuraciÃ³n existente no se modificarÃ¡ desde esta pantalla.</AlertDescription></Alert> : null}
    {!sourceDraft.sourceFileId ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Falta un archivo fuente</AlertTitle><AlertDescription>SeleccionÃ¡ e inspeccionÃ¡ un archivo antes de configurar las columnas.</AlertDescription></Alert> : null}
    {sourceDraft.sourceFileId && structureQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando columnas inspeccionadasâ€¦</p> : null}
    {sourceDraft.sourceFileId && !structureQuery.isPending && !sourceColumns.length ? <Alert><AlertCircle aria-hidden="true" /><AlertTitle>No hay columnas inspeccionadas</AlertTitle><AlertDescription>RevisÃ¡ la hoja y la fila de encabezado del archivo fuente.</AlertDescription></Alert> : null}
    <div className="space-y-4">{columns.map((column, index) => <fieldset className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-end" key={column.id}><legend className="px-1 text-sm font-medium">Columna {index + 1}</legend>
      <div className="space-y-2"><Label htmlFor={`output-${column.id}`}>Nombre de salida</Label><Input disabled={!canEdit} id={`output-${column.id}`} onChange={(event) => updateColumn(column.id, { outputColumn: event.target.value })} value={column.outputColumn} /></div>
      <div className="space-y-2"><Label>Operaci{"\u00f3"}n</Label><Select disabled={!canEdit} onValueChange={(value) => changeOperation(column.id, value as Operation)} value={column.operation}><SelectTrigger aria-label={`Operaci${"\u00f3"}n de columna ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent>{OPERATIONS.map((operation) => <SelectItem key={operation} value={operation}>{operation}</SelectItem>)}</SelectContent></Select></div>
      <Button aria-label={`Eliminar columna ${index + 1}`} disabled={!canEdit} onClick={() => setColumns((current) => current.filter((item) => item.id !== column.id))} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button>
      <div className="space-y-3 md:col-span-3">
        {column.operation === "SOURCE" ? <SourceSelect column={column} disabled={!canEdit || !sourceColumns.length} onChange={(sourceColumn) => updateColumn(column.id, { sourceColumn })} sourceColumns={sourceColumns} /> : null}
        {column.operation === "CONSTANT" ? <TextInput column={column} disabled={!canEdit} label="Valor constante" onChange={(value) => updateColumn(column.id, { value })} /> : null}
        {column.operation === "CONCAT" ? <ConcatEditor column={column} disabled={!canEdit} onAdd={() => updateColumn(column.id, { concatParts: [...column.concatParts, { id: Math.max(0, ...column.concatParts.map((part) => part.id)) + 1, type: "SOURCE", value: "" }] })} onRemove={(partId) => updateColumn(column.id, { concatParts: column.concatParts.filter((part) => part.id !== partId) })} onUpdate={(partId, update) => updateConcatPart(column, partId, update)} sourceColumns={sourceColumns} /> : null}
        {column.operation === "ARITHMETIC" ? <ArithmeticEditor column={column} disabled={!canEdit} onOperandChange={(side, update) => updateOperand(column, side, update)} onOperatorChange={(operator) => updateColumn(column.id, { operator })} sourceColumns={sourceColumns} /> : null}
        {column.operation === "VALUE_MAP" ? <ValueMapEditor column={column} disabled={!canEdit} onAdd={() => updateColumn(column.id, { mapping: [...column.mapping, { id: Math.max(0, ...column.mapping.map((mapping) => mapping.id)) + 1, key: "", value: "" }] })} onMappingChange={(mappingId, update) => updateMapping(column, mappingId, update)} onPolicyChange={(unmappedPolicy) => updateColumn(column.id, { unmappedPolicy })} onRemove={(mappingId) => updateColumn(column.id, { mapping: column.mapping.filter((mapping) => mapping.id !== mappingId) })} onSourceChange={(sourceColumn) => updateColumn(column.id, { sourceColumn })} onDefaultChange={(defaultValue) => updateColumn(column.id, { defaultValue })} sourceColumns={sourceColumns} /> : null}
      </div>
    </fieldset>)}</div>
    <RowRulesEditor disabled={!canEdit} onChange={(nextRows) => { setRows(nextRows); setValidationMessage(null); }} outputColumns={outputColumns} rows={rows} sourceColumns={sourceColumns} />
    {validationMessage ? <p className="text-sm text-destructive" role="alert">{validationMessage}</p> : null}
    {saveMutation.isError ? <p className="text-sm text-destructive" role="alert">{getErrorMessage(saveMutation.error)}</p> : null}
    {saveMutation.isSuccess ? <p className="text-sm text-success-foreground" role="status">ConfiguraciÃ³n guardada.</p> : null}
    <div className="flex flex-wrap gap-3"><Button disabled={!canEdit} onClick={() => { setColumns((current) => [...current, emptyColumn(nextId)]); setNextId((current) => current + 1); }} type="button" variant="outline"><Plus aria-hidden="true" />Agregar columna</Button><Button disabled={!canEdit || saveMutation.isPending || !sourceColumns.length} onClick={() => void save()} type="button"><Save aria-hidden="true" />{saveMutation.isPending ? "Guardandoâ€¦" : "Guardar configuraciÃ³n"}</Button></div>
  </CardContent></Card>;
}

function SourceSelect({ column, disabled, onChange, sourceColumns }: { column: DraftColumn; disabled: boolean; onChange: (value: string) => void; sourceColumns: string[] }) { return <div className="space-y-2"><Label>Columna de origen</Label><Select disabled={disabled} onValueChange={onChange} value={column.sourceColumn || undefined}><SelectTrigger aria-label="Columna de origen"><SelectValue placeholder="SeleccionÃ¡ una columna inspeccionada" /></SelectTrigger><SelectContent>{sourceColumns.map((sourceColumn) => <SelectItem key={sourceColumn} value={sourceColumn}>{sourceColumn}</SelectItem>)}</SelectContent></Select></div>; }
function TextInput({ column, disabled, label, onChange }: { column: DraftColumn; disabled: boolean; label: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={`${label}-${column.id}`}>{label}</Label><Input disabled={disabled} id={`${label}-${column.id}`} onChange={(event) => onChange(event.target.value)} value={column.value} /></div>; }
function ConcatEditor({ column, disabled, onAdd, onRemove, onUpdate, sourceColumns }: { column: DraftColumn; disabled: boolean; onAdd: () => void; onRemove: (id: number) => void; onUpdate: (id: number, update: Partial<DraftConcatPart>) => void; sourceColumns: string[] }) { return <div className="space-y-3"><Label>Partes de concatenaciÃ³n</Label>{column.concatParts.map((part, index) => <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_auto]" key={part.id}><Select disabled={disabled} onValueChange={(type) => onUpdate(part.id, { type: type as ConcatPartType, value: "" })} value={part.type}><SelectTrigger aria-label={`Tipo de parte ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SOURCE">SOURCE</SelectItem><SelectItem value="LITERAL">LITERAL</SelectItem></SelectContent></Select>{part.type === "SOURCE" ? <Select disabled={disabled} onValueChange={(value) => onUpdate(part.id, { value })} value={part.value || undefined}><SelectTrigger aria-label={`Columna de parte ${index + 1}`}><SelectValue placeholder="Columna inspeccionada" /></SelectTrigger><SelectContent>{sourceColumns.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select> : <Input aria-label={`Literal de parte ${index + 1}`} disabled={disabled} onChange={(event) => onUpdate(part.id, { value: event.target.value })} value={part.value} />}<Button aria-label={`Eliminar parte ${index + 1}`} disabled={disabled} onClick={() => onRemove(part.id)} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button></div>)}<Button disabled={disabled} onClick={onAdd} type="button" variant="outline"><Plus aria-hidden="true" />Agregar parte</Button></div>; }
function ArithmeticEditor({ column, disabled, onOperandChange, onOperatorChange, sourceColumns }: { column: DraftColumn; disabled: boolean; onOperandChange: (side: "leftOperand" | "rightOperand", update: Partial<DraftOperand>) => void; onOperatorChange: (operator: ArithmeticOperator) => void; sourceColumns: string[] }) { return <div className="grid gap-3 md:grid-cols-3"><OperandEditor disabled={disabled} label="Operando izquierdo" onChange={(update) => onOperandChange("leftOperand", update)} operand={column.leftOperand} sourceColumns={sourceColumns} /><div className="space-y-2"><Label>Operador</Label><Select disabled={disabled} onValueChange={(value) => onOperatorChange(value as ArithmeticOperator)} value={column.operator}><SelectTrigger aria-label="Operador aritmÃ©tico"><SelectValue /></SelectTrigger><SelectContent>{ARITHMETIC_OPERATORS.map((operator) => <SelectItem key={operator} value={operator}>{operator}</SelectItem>)}</SelectContent></Select></div><OperandEditor disabled={disabled} label="Operando derecho" onChange={(update) => onOperandChange("rightOperand", update)} operand={column.rightOperand} sourceColumns={sourceColumns} /></div>; }
function OperandEditor({ disabled, label, onChange, operand, sourceColumns }: { disabled: boolean; label: string; onChange: (update: Partial<DraftOperand>) => void; operand: DraftOperand; sourceColumns: string[] }) { return <div className="space-y-2"><Label>{label}</Label><div className="grid gap-2 sm:grid-cols-2"><Select disabled={disabled} onValueChange={(type) => onChange({ type: type as OperandType, value: "" })} value={operand.type}><SelectTrigger aria-label={`${label} tipo`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SOURCE">SOURCE</SelectItem><SelectItem value="CONSTANT">CONSTANT</SelectItem></SelectContent></Select>{operand.type === "SOURCE" ? <Select disabled={disabled} onValueChange={(value) => onChange({ value })} value={operand.value || undefined}><SelectTrigger aria-label={label}><SelectValue placeholder="Columna" /></SelectTrigger><SelectContent>{sourceColumns.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select> : <Input aria-label={label} disabled={disabled} inputMode="decimal" onChange={(event) => onChange({ value: event.target.value })} value={operand.value} />}</div></div>; }
function ValueMapEditor({ column, disabled, onAdd, onDefaultChange, onMappingChange, onPolicyChange, onRemove, onSourceChange, sourceColumns }: { column: DraftColumn; disabled: boolean; onAdd: () => void; onDefaultChange: (value: string) => void; onMappingChange: (id: number, update: Partial<DraftMapping>) => void; onPolicyChange: (value: UnmappedPolicy) => void; onRemove: (id: number) => void; onSourceChange: (value: string) => void; sourceColumns: string[] }) { return <div className="space-y-3"><SourceSelect column={column} disabled={disabled} onChange={onSourceChange} sourceColumns={sourceColumns} /><Label>Equivalencias</Label>{column.mapping.map((mapping, index) => <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={mapping.id}><Input aria-label={`Clave de equivalencia ${index + 1}`} disabled={disabled} onChange={(event) => onMappingChange(mapping.id, { key: event.target.value })} placeholder="Valor de origen" value={mapping.key} /><Input aria-label={`Valor de equivalencia ${index + 1}`} disabled={disabled} onChange={(event) => onMappingChange(mapping.id, { value: event.target.value })} placeholder="Valor resultante" value={mapping.value} /><Button aria-label={`Eliminar equivalencia ${index + 1}`} disabled={disabled} onClick={() => onRemove(mapping.id)} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button></div>)}<Button disabled={disabled} onClick={onAdd} type="button" variant="outline"><Plus aria-hidden="true" />Agregar equivalencia</Button><div className="space-y-2"><Label>Valores no mapeados</Label><Select disabled={disabled} onValueChange={(value) => onPolicyChange(value as UnmappedPolicy)} value={column.unmappedPolicy}><SelectTrigger aria-label="PolÃ­tica de valores no mapeados"><SelectValue /></SelectTrigger><SelectContent>{UNMAPPED_POLICIES.map((policy) => <SelectItem key={policy} value={policy}>{policy}</SelectItem>)}</SelectContent></Select></div>{column.unmappedPolicy === "USE_DEFAULT" ? <div className="space-y-2"><Label htmlFor={`default-${column.id}`}>Valor predeterminado</Label><Input disabled={disabled} id={`default-${column.id}`} onChange={(event) => onDefaultChange(event.target.value)} value={column.defaultValue} /></div> : null}</div>; }
