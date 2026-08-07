import { PageHeader } from "@/components/layout/page-header";
import { ProcessList } from "@/features/processes/components/process-list";

export default function ProcessesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Procesos" },
        ]}
        description="Seleccioná un proceso para comenzar o continuar una operación."
        title="Procesos"
      />

      <ProcessList />
    </div>
  );
}
