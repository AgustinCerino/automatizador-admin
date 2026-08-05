import { Workflow } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function ProcessesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Procesos" },
        ]}
        description="Este espacio reunirá la definición y organización de los procesos administrativos."
        title="Procesos"
      />

      <EmptyState
        description="Los procesos estarán disponibles cuando se incorpore su gestión a la plataforma."
        icon={<Workflow />}
        title="No hay procesos cargados en esta vista."
      />
    </div>
  );
}
