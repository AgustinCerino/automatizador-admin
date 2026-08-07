import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProcessRead } from "@/features/processes/types";

interface ProcessCardProps {
  process: ProcessRead;
}

export function ProcessCard({ process }: ProcessCardProps) {
  const href = `/procesos/${process.id}/ejecuciones`;

  return (
    <Card className="h-full" role="article">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{process.tipo}</Badge>
          <StatusBadge status={process.estado} />
        </div>
        <CardTitle className="mt-2 text-lg">{process.nombre}</CardTitle>
        {process.descripcion ? (
          <CardDescription className="line-clamp-3 leading-6">
            {process.descripcion}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto" />
      <CardFooter>
        <Link
          className="inline-flex min-h-9 items-center gap-2 rounded-lg font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={href}
        >
          Abrir proceso
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
