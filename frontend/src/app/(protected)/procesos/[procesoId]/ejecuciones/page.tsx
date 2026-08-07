import { notFound } from "next/navigation";

import { ProcessExecutionsView } from "@/features/executions/components/process-executions-view";
import { parsePositiveIntegerParam } from "@/lib/identifiers";

interface ProcessExecutionsPageProps {
  params: Promise<{ procesoId: string }>;
}

export default async function ProcessExecutionsPage({
  params,
}: ProcessExecutionsPageProps) {
  const { procesoId: rawProcessId } = await params;
  const processId = parsePositiveIntegerParam(rawProcessId);

  if (!processId) {
    notFound();
  }

  return <ProcessExecutionsView processId={processId} />;
}
