"use client";

import Link from "next/link";

import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl space-y-4">
        <ErrorState
          description="No pudimos mostrar el contenido solicitado. Podés volver a intentarlo."
          headingLevel={1}
          retry={reset}
          title="Ocurrió un problema inesperado"
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
