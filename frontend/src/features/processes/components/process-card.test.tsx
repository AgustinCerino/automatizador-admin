import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProcessCard } from "@/features/processes/components/process-card";
import type { ProcessRead } from "@/features/processes/types";

const PROCESS = {
  cliente_id: 7,
  created_at: "2026-08-07T12:00:00Z",
  descripcion: "Transforma columnas de una planilla.",
  estado: "ACTIVO",
  id: 4,
  nombre: "Transformación Excel",
  tipo: "TRANSFORMACION_EXCEL",
  updated_at: null,
} satisfies ProcessRead;

describe("ProcessCard", () => {
  it("muestra los campos reales y enlaza al historial del proceso", () => {
    render(<ProcessCard process={PROCESS} />);

    expect(screen.getByText(PROCESS.nombre)).toBeInTheDocument();
    expect(screen.getByText(PROCESS.descripcion)).toBeInTheDocument();
    expect(screen.getByText(PROCESS.tipo)).toBeInTheDocument();
    expect(screen.getByText(PROCESS.estado)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir proceso/i })).toHaveAttribute(
      "href",
      "/procesos/4/ejecuciones",
    );
  });

  it("omite la descripción cuando el contrato devuelve null", () => {
    render(<ProcessCard process={{ ...PROCESS, descripcion: null }} />);

    expect(screen.queryByText(PROCESS.descripcion)).not.toBeInTheDocument();
  });
});
