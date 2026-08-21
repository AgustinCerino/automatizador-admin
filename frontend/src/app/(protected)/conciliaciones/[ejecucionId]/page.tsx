import { notFound } from "next/navigation";

import { ConciliationWorkspace } from "@/features/conciliations/components/conciliation-workspace";
import { parsePositiveIntegerParam } from "@/lib/identifiers";

interface ConciliationPageProps {
  params: Promise<{ ejecucionId: string }>;
}

export default async function ConciliationPage({ params }: ConciliationPageProps) {
  const { ejecucionId: rawExecutionId } = await params;
  const executionId = parsePositiveIntegerParam(rawExecutionId);

  if (!executionId) {
    notFound();
  }

  return <ConciliationWorkspace executionId={executionId} />;
}
