import { PageHeader } from "@/components/layout/page-header";
import { ProcessList } from "@/features/processes/components/process-list";

export default function ExecutionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Ejecuciones" },
        ]}
        description="Seleccioná un proceso para consultar sus ejecuciones."
        title="Ejecuciones"
      />
      <ProcessList />
    </div>
  );
}
