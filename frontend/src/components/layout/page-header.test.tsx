import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/layout/page-header";

describe("PageHeader", () => {
  it("muestra el título y la descripción", () => {
    render(
      <PageHeader
        description="Descripción de la sección."
        title="Sección"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Sección" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Descripción de la sección.")).toBeInTheDocument();
  });
});
