import { notFound } from "next/navigation";

import { TransformationWorkspace } from "@/features/transformations/components/transformation-workspace";
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

  return <TransformationWorkspace executionId={executionId} />;
}
