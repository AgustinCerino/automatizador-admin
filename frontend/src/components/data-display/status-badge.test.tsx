import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/data-display/status-badge";

describe("StatusBadge", () => {
  it("muestra el nombre del estado", () => {
    render(<StatusBadge status="COMPLETADO" />);

    expect(screen.getByText("COMPLETADO")).toBeInTheDocument();
  });

  it("usa la variante neutral para un estado desconocido", () => {
    render(<StatusBadge status="PENDIENTE" />);

    expect(screen.getByText("PENDIENTE")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  });
});
