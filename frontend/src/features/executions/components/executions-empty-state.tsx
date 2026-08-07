import { ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/feedback/empty-state";

interface ExecutionsEmptyStateProps {
  action: ReactNode;
}

export function ExecutionsEmptyState({ action }: ExecutionsEmptyStateProps) {
  return (
    <EmptyState
      action={action}
      description="Creá una ejecución para comenzar a trabajar con este proceso."
      icon={<ListChecks />}
      title="Todavía no hay ejecuciones."
    />
  );
}
