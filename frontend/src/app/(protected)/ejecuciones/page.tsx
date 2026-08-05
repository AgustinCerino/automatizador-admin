import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const placeholderRows = ["primera", "segunda", "tercera"] as const;
const placeholderColumns = ["primera", "segunda", "tercera", "cuarta"] as const;

export default function ExecutionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Ejecuciones" },
        ]}
        description="Consultá el seguimiento de las automatizaciones cuando el historial esté disponible."
        title="Ejecuciones"
      />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            Historial de ejecuciones
          </h2>
          <CardDescription>
            Las ejecuciones aparecerán en esta vista cuando se conecte la API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div aria-hidden="true" className="overflow-x-auto rounded-lg border">
            <div className="min-w-144 px-4">
              <div className="grid grid-cols-4 gap-6 border-b py-4">
                {placeholderColumns.map((column) => (
                  <Skeleton
                    className="h-4 w-24 motion-reduce:animate-none"
                    key={column}
                  />
                ))}
              </div>
              {placeholderRows.map((row) => (
                <div
                  className="grid grid-cols-4 gap-6 border-b py-4 last:border-0"
                  key={row}
                >
                  <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
