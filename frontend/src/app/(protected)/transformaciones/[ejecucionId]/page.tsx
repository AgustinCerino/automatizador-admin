import { notFound, redirect } from "next/navigation";

import { TransformationWorkspace } from "@/features/transformations/components/transformation-workspace";
import { getServerSession } from "@/lib/auth/server-session";
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

  const session = await getServerSession();
  if (!session.authenticated) redirect("/login");

  return (
    <TransformationWorkspace
      canManageTemplates={session.user.rol === "ADMIN"}
      executionId={executionId}
    />
  );
}
