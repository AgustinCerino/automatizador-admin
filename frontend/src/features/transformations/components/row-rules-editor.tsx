"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FilterOperator = "EQUALS" | "IN" | "NOT_EMPTY" | "IS_EMPTY" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS";
export type SortDirection = "ASC" | "DESC";

export interface DraftFilter { id: number; sourceColumn: string; operator: FilterOperator; value: string; values: string }
export interface DraftSortRule { id: number; outputColumn: string; direction: SortDirection }
export interface DraftRows { filters: DraftFilter[]; removeDuplicates: { enabled: boolean; byOutputColumns: string[] }; sortBy: DraftSortRule[] }

export const EMPTY_ROWS: DraftRows = { filters: [], removeDuplicates: { enabled: false, byOutputColumns: [] }, sortBy: [] };
export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "EQUALS", label: "Igual a" }, { value: "IN", label: "En lista" },
  { value: "NOT_EMPTY", label: "No vacio" }, { value: "IS_EMPTY", label: "Vacio" },
  { value: "GREATER_THAN", label: "Mayor que" }, { value: "LESS_THAN", label: "Menor que" },
  { value: "CONTAINS", label: "Contiene" },
];

export function RowRulesEditor({ disabled, onChange, outputColumns, rows, sourceColumns }: { disabled: boolean; onChange: (rows: DraftRows) => void; outputColumns: string[]; rows: DraftRows; sourceColumns: string[] }) {
  const updateFilter = (id: number, update: Partial<DraftFilter>) => onChange({ ...rows, filters: rows.filters.map((filter) => filter.id === id ? { ...filter, ...update } : filter) });
  const updateSort = (id: number, update: Partial<DraftSortRule>) => onChange({ ...rows, sortBy: rows.sortBy.map((rule) => rule.id === id ? { ...rule, ...update } : rule) });
  const needsValue = (operator: FilterOperator) => !["NOT_EMPTY", "IS_EMPTY"].includes(operator);
  const hasOutputColumns = outputColumns.length > 0;

  return <div className="space-y-5">
    <section className="space-y-3 rounded-lg border p-4"><div><h3 className="font-medium">Filtros</h3><p className="text-sm text-muted-foreground">Se aplican sobre las columnas inspeccionadas del archivo fuente.</p></div>
      {rows.filters.map((filter, index) => <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto]" key={filter.id}>
        <Select disabled={disabled} onValueChange={(sourceColumn) => updateFilter(filter.id, { sourceColumn })} value={filter.sourceColumn || undefined}><SelectTrigger aria-label={`Columna del filtro ${index + 1}`}><SelectValue placeholder="Columna" /></SelectTrigger><SelectContent>{sourceColumns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}</SelectContent></Select>
        <Select disabled={disabled} onValueChange={(operator) => updateFilter(filter.id, { operator: operator as FilterOperator, value: "", values: "" })} value={filter.operator}><SelectTrigger aria-label={`Operador del filtro ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATORS.map((operator) => <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>)}</SelectContent></Select>
        {needsValue(filter.operator) ? <Input aria-label={`Valor del filtro ${index + 1}`} disabled={disabled} onChange={(event) => updateFilter(filter.id, filter.operator === "IN" ? { values: event.target.value } : { value: event.target.value })} placeholder={filter.operator === "IN" ? "Valores separados por coma" : "Valor"} value={filter.operator === "IN" ? filter.values : filter.value} /> : <p className="self-center text-sm text-muted-foreground">No requiere valor</p>}
        <Button aria-label={`Eliminar filtro ${index + 1}`} disabled={disabled} onClick={() => onChange({ ...rows, filters: rows.filters.filter((item) => item.id !== filter.id) })} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button>
      </div>)}
      <Button disabled={disabled || rows.filters.length >= 5} onClick={() => onChange({ ...rows, filters: [...rows.filters, { id: Math.max(0, ...rows.filters.map((filter) => filter.id)) + 1, sourceColumn: "", operator: "EQUALS", value: "", values: "" }] })} type="button" variant="outline"><Plus aria-hidden="true" />Agregar filtro</Button>
    </section>
    <section className="space-y-3 rounded-lg border p-4"><div><h3 className="font-medium">Deduplicacion</h3><p className="text-sm text-muted-foreground">Conserva la primera fila de cada combinacion duplicada.</p></div>
      <label className="flex items-center gap-2 text-sm"><input checked={rows.removeDuplicates.enabled} disabled={disabled} onChange={(event) => onChange({ ...rows, removeDuplicates: { enabled: event.target.checked, byOutputColumns: event.target.checked ? rows.removeDuplicates.byOutputColumns : [] } })} type="checkbox" />Eliminar duplicados</label>
      {rows.removeDuplicates.enabled ? <div className="space-y-2"><Label>Columnas de salida</Label><div className="flex flex-wrap gap-x-4 gap-y-2">{outputColumns.map((column) => <label className="flex items-center gap-2 text-sm" key={column}><input checked={rows.removeDuplicates.byOutputColumns.includes(column)} disabled={disabled} onChange={(event) => onChange({ ...rows, removeDuplicates: { ...rows.removeDuplicates, byOutputColumns: event.target.checked ? [...rows.removeDuplicates.byOutputColumns, column] : rows.removeDuplicates.byOutputColumns.filter((item) => item !== column) } })} type="checkbox" />{column}</label>)}</div></div> : null}
    </section>
    <section className="space-y-3 rounded-lg border p-4"><div><h3 className="font-medium">Ordenamiento</h3><p className="text-sm text-muted-foreground">El orden de la lista define la prioridad.</p></div>
      {!hasOutputColumns ? <p className="text-sm text-muted-foreground">Primero configur\u00e1 al menos una columna de salida v\u00e1lida.</p> : null}
      {rows.sortBy.map((rule, index) => <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]" key={rule.id}>
        {!hasOutputColumns || !outputColumns.includes(rule.outputColumn) ? <p className="text-sm text-destructive md:col-span-3">La columna de salida elegida ya no est\u00e1 disponible.</p> : null}
        <select aria-label={`Columna de ordenamiento ${index + 1}`} className="h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || !hasOutputColumns} onChange={(event) => updateSort(rule.id, { outputColumn: event.target.value })} value={rule.outputColumn}>
          <option disabled value="">Columna de salida</option>{outputColumns.map((column) => <option key={column} value={column}>{column}</option>)}
        </select>
        <select aria-label={`Direccion de ordenamiento ${index + 1}`} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || !hasOutputColumns} onChange={(event) => updateSort(rule.id, { direction: event.target.value as SortDirection })} value={rule.direction}>
          <option value="ASC">Ascendente</option><option value="DESC">Descendente</option>
        </select>
        <Button aria-label={`Eliminar ordenamiento ${index + 1}`} disabled={disabled} onClick={() => onChange({ ...rows, sortBy: rows.sortBy.filter((item) => item.id !== rule.id) })} size="icon" type="button" variant="outline"><Trash2 aria-hidden="true" /></Button>
      </div>)}
      <Button disabled={disabled || !hasOutputColumns || rows.sortBy.length >= 3} onClick={() => onChange({ ...rows, sortBy: [...rows.sortBy, { id: Math.max(0, ...rows.sortBy.map((rule) => rule.id)) + 1, outputColumn: "", direction: "ASC" }] })} type="button" variant="outline"><Plus aria-hidden="true" />Agregar ordenamiento</Button>
    </section>
  </div>;
}
