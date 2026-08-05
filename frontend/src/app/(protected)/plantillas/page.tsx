import { Files } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Plantillas" },
        ]}
        description="Este espacio reunirá las plantillas utilizadas por las automatizaciones administrativas."
        title="Plantillas"
      />

      <EmptyState
        description="Las plantillas se mostrarán cuando su gestión esté disponible en la plataforma."
        icon={<Files />}
        title="No hay plantillas disponibles en esta vista."
      />
    </div>
  );
}
