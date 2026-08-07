import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExecutionsEmptyState } from "@/features/executions/components/executions-empty-state";
import { getExecutionHref } from "@/features/executions/navigation";
import type { ExecutionRead } from "@/features/executions/types";
import { formatDateTime } from "@/lib/format-date";

interface ExecutionsTableProps {
  emptyAction: ReactNode;
  executions: readonly ExecutionRead[];
  processType: string;
}

export function ExecutionsTable({
  emptyAction,
  executions,
  processType,
}: ExecutionsTableProps) {
  if (executions.length === 0) {
    return <ExecutionsEmptyState action={emptyAction} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead>Finalizada</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => {
            const href = getExecutionHref(processType, execution.id);

            return (
              <TableRow id={`ejecucion-${execution.id}`} key={execution.id}>
                <TableCell className="font-medium">#{execution.id}</TableCell>
                <TableCell>
                  <StatusBadge status={execution.estado} />
                </TableCell>
                <TableCell>{formatDateTime(execution.created_at)}</TableCell>
                <TableCell>{formatDateTime(execution.finished_at)}</TableCell>
                <TableCell className="text-right">
                  {href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir ejecución ${execution.id}`}
                        href={href}
                      >
                        Abrir
                        <ExternalLink aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin vista disponible
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
