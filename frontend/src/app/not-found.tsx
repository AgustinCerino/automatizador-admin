import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-xl rounded-xl border bg-card px-6 py-12 text-center">
        <p className="text-sm font-semibold text-primary">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Página no encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          La dirección ingresada no corresponde a una página disponible.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Ir a Inicio</Link>
        </Button>
      </section>
    </main>
  );
}
