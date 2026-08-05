import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/feedback/empty-state";

describe("EmptyState", () => {
  it("muestra el título y la descripción", () => {
    render(
      <EmptyState
        description="Descripción del estado vacío."
        title="Sin elementos"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sin elementos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Descripción del estado vacío."),
    ).toBeInTheDocument();
  });

  it("muestra una acción cuando se proporciona", () => {
    render(
      <EmptyState
        action={<button type="button">Acción disponible</button>}
        description="Descripción del estado vacío."
        title="Sin elementos"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Acción disponible" }),
    ).toBeInTheDocument();
  });
});
