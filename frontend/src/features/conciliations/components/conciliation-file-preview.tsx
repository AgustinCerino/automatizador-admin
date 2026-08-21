import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConciliationFilePreview } from "@/features/conciliations/types";
import { formatNumber } from "@/lib/format-values";

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Dato complejo";
  }
}

export function ConciliationFilePreviewTable({
  preview,
  role,
}: {
  preview: ConciliationFilePreview;
  role: "A" | "B";
}) {
  if (preview.columns.length === 0 || preview.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        El archivo {role} no contiene filas para mostrar.
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border">
      <Table>
        <TableCaption>
          Primeras {formatNumber(preview.rows.length)} de {formatNumber(preview.total_rows)} filas.
        </TableCaption>
        <TableHeader>
          <TableRow>
            {preview.columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {preview.columns.map((column) => (
                <TableCell
                  className="max-w-64 truncate"
                  key={column}
                  title={formatPreviewValue(row[column])}
                >
                  {formatPreviewValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
