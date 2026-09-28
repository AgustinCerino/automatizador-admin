import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConciliationClosurePanel } from "@/features/conciliations/components/conciliation-closure-panel";
import { ApiError } from "@/lib/api/errors";

const BASE_PROPS = {
  approvalError: null,
  approving: false,
  exportError: null,
  exporting: false,
  onApprove: vi.fn(async () => {}),
  onExport: vi.fn(async () => {}),
  onReject: vi.fn(async () => {}),
  pendingReviews: 0,
  rejectionError: null,
  rejecting: false,
  stale: false,
  state: "REQUIERE_REVISION",
};

describe("ConciliationClosurePanel", () => {
  it("solicita confirmación y evita una aprobación doble", async () => {
    let finish: (() => void) | undefined;
    const onApprove = vi.fn(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    render(<ConciliationClosurePanel {...BASE_PROPS} onApprove={onApprove} />);

    fireEvent.click(screen.getByRole("button", { name: "Aprobar conciliación" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Confirmar aprobación");
    const confirm = screen.getByRole("button", { name: "Confirmar aprobación" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onApprove).toHaveBeenCalledTimes(1);

    finish?.();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("envía el motivo normalizado y lo conserva cuando el rechazo falla", async () => {
    const onReject = vi.fn().mockRejectedValue(
      new ApiError(409, { message: "El estado cambió." }),
    );
    render(<ConciliationClosurePanel {...BASE_PROPS} onReject={onReject} />);

    fireEvent.click(screen.getByRole("button", { name: "Rechazar conciliación" }));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "  Comprobante inválido  " },
    });
    const confirm = screen.getByRole("button", { name: "Confirmar rechazo" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(onReject).toHaveBeenCalledTimes(1));
    expect(onReject).toHaveBeenCalledWith("Comprobante inválido");
    expect(screen.getByLabelText("Motivo")).toHaveValue("  Comprobante inválido  ");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("bloquea el cierre con pendientes o datos stale", () => {
    const { rerender } = render(
      <ConciliationClosurePanel {...BASE_PROPS} pendingReviews={2} />,
    );
    expect(screen.getByRole("button", { name: "Aprobar conciliación" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar conciliación" })).toBeEnabled();
    expect(screen.getByText(/2 revisiones pendientes/)).toBeInTheDocument();

    rerender(<ConciliationClosurePanel {...BASE_PROPS} stale />);
    expect(screen.getByRole("button", { name: "Aprobar conciliación" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar conciliación" })).toBeDisabled();
    expect(screen.getByText("Acciones pausadas")).toBeInTheDocument();
  });

  it("sólo descarga en APROBADO y evita descargas duplicadas", async () => {
    let finish: (() => void) | undefined;
    const onExport = vi.fn(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    render(
      <ConciliationClosurePanel
        {...BASE_PROPS}
        onExport={onExport}
        state="APROBADO"
      />,
    );

    expect(screen.getByRole("button", { name: "Aprobar conciliación" })).toBeDisabled();
    const download = screen.getByRole("button", { name: "Descargar XLSX" });
    fireEvent.click(download);
    fireEvent.click(download);
    expect(onExport).toHaveBeenCalledTimes(1);
    finish?.();
  });

  it("muestra errores controlados de las tres operaciones", () => {
    render(
      <ConciliationClosurePanel
        {...BASE_PROPS}
        approvalError={new ApiError(409, { message: "No se puede aprobar." })}
        exportError={new ApiError(503, { message: "Exportación no disponible." })}
        rejectionError={new ApiError(403, { message: "No se puede rechazar." })}
      />,
    );

    expect(screen.getByText("No se puede aprobar.")).toBeInTheDocument();
    expect(screen.getByText("No se puede rechazar.")).toBeInTheDocument();
    expect(screen.getByText("Exportación no disponible.")).toBeInTheDocument();
  });
});
