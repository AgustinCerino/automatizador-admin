import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadTransformationResult } from "@/features/transformations/api/download-transformation-result";
import { useTransformationSummaryQuery } from "@/features/transformations/api/use-transformation-summary-query";
import { TransformationExecutionActions } from "@/features/executions/components/transformation-execution-actions";
import { ApiError } from "@/lib/api/errors";

vi.mock(
  "@/features/transformations/api/download-transformation-result",
  () => ({ downloadTransformationResult: vi.fn() }),
);
vi.mock(
  "@/features/transformations/api/use-transformation-summary-query",
  () => ({ useTransformationSummaryQuery: vi.fn() }),
);

const downloadMock = vi.mocked(downloadTransformationResult);
const summaryQueryMock = vi.mocked(useTransformationSummaryQuery);

describe("TransformationExecutionActions", () => {
  beforeEach(() => {
    downloadMock.mockReset().mockResolvedValue(undefined);
    summaryQueryMock.mockReset();
  });

  it("muestra la descarga sólo cuando el backend informa la capability", () => {
    summaryQueryMock.mockReturnValue({
      data: { can_download: true },
    } as never);

    const { rerender } = render(
      <TransformationExecutionActions executionId={31} />,
    );

    expect(
      screen.getByRole("button", { name: "Descargar resultado" }),
    ).toBeEnabled();

    summaryQueryMock.mockReturnValue({
      data: { can_download: false },
    } as never);
    rerender(<TransformationExecutionActions executionId={32} />);

    expect(
      screen.queryByRole("button", { name: "Descargar resultado" }),
    ).not.toBeInTheDocument();
  });

  it("descarga el resultado histórico correcto una sola vez mientras procesa", async () => {
    const user = userEvent.setup();
    let resolveDownload: (() => void) | undefined;
    downloadMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve;
      }),
    );
    summaryQueryMock.mockReturnValue({
      data: { can_download: true },
    } as never);
    render(
      <TransformationExecutionActions
        executionId={31}
        fallbackFilename="resultado-31.xlsx"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Descargar resultado",
    });
    await user.click(button);
    await user.click(button);

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(downloadMock).toHaveBeenCalledWith(31, "resultado-31.xlsx");
    expect(screen.getByRole("button", { name: "Descargando…" })).toBeDisabled();

    resolveDownload?.();
  });

  it("informa de forma controlada cuando el archivo ya no existe", async () => {
    const user = userEvent.setup();
    downloadMock.mockRejectedValue(
      new ApiError(404, { message: "El recurso solicitado no existe." }),
    );
    summaryQueryMock.mockReturnValue({
      data: { can_download: true },
    } as never);
    render(<TransformationExecutionActions executionId={31} />);

    await user.click(
      screen.getByRole("button", { name: "Descargar resultado" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El archivo ya no está disponible para descargar.",
    );
  });
});
