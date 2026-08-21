import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";

import { BackendStatusCard } from "@/features/system/components/backend-status-card";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { navigationItems } from "@/lib/navigation";

const featureItems = navigationItems.filter((item) => item.href !== "/");

export default function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[{ label: "Inicio" }]}
        description="Centralizá la preparación, ejecución y seguimiento de automatizaciones administrativas desde un único espacio."
        title="Inicio"
      />

      <section aria-label="Secciones principales">
        <div className="grid gap-4 md:grid-cols-3">
          {featureItems.map((item) => {
            const Icon = item.icon;

            return (
              <Card className="h-full ring-primary/30" key={item.href}>
                <CardHeader>
                  <div
                    aria-hidden="true"
                    className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                  >
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-base font-semibold text-primary">
                    {item.label}
                  </h2>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button asChild>
                    <Link href={item.href}>
                      Ver {item.label.toLowerCase()}
                      <ArrowRight aria-hidden="true" data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Estado del sistema" className="max-w-xl">
        <BackendStatusCard />
      </section>

      <Alert className="border-information/25 bg-information/5" role="note">
        <Info aria-hidden="true" className="text-information" />
        <AlertTitle>Implementación progresiva</AlertTitle>
        <AlertDescription>
          Las funciones se habilitarán de forma gradual a medida que se
          incorporen las conexiones y herramientas de gestión.
        </AlertDescription>
      </Alert>
    </div>
  );
}
