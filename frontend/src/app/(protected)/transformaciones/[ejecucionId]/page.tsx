import { notFound } from "next/navigation";

import { TransformationExecutionView } from "@/features/executions/components/transformation-execution-view";
import { parsePositiveIntegerParam } from "@/lib/identifiers";

interface TransformationPageProps {
  params: Promise<{ ejecucionId: string }>;
}

export default async function TransformationPage({
  params,
}: TransformationPageProps) {
  const { ejecucionId: rawExecutionId } = await params;
  const executionId = parsePositiveIntegerParam(rawExecutionId);

  if (!executionId) {
    notFound();
  }

  return <TransformationExecutionView executionId={executionId} />;
}
