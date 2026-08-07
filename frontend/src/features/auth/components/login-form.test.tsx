import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/auth/components/login-form";
import type { LoginSuccessResponse } from "@/features/auth/types";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/client")>();

  return {
    ...original,
    apiFetch: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

const loginResponse: LoginSuccessResponse = {
  user: {
    id: 12,
    cliente_id: 4,
    nombre: "Ana Pérez",
    email: "ana@example.com",
    rol: "ADMIN",
    estado: "ACTIVO",
  },
};

async function completeValidForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    email = "ana@example.com",
    password = "secreto",
  }: { email?: string; password?: string } = {},
) {
  await user.type(screen.getByLabelText("Correo electrónico"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(
    screen.getByRole("button", { name: "Iniciar sesión" }),
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(loginResponse);
  });

  it("expone campos etiquetados y autocompletado apropiado", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      screen.getByRole("button", { name: "Mostrar contraseña" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("marca email y contraseña como requeridos sin llamar a la API", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    );

    const emailError = await screen.findByText(
      "Ingresá tu correo electrónico.",
    );
    const passwordError = screen.getByText("Ingresá tu contraseña.");
    const emailInput = screen.getByLabelText("Correo electrónico");
    const passwordInput = screen.getByLabelText("Contraseña");

    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", emailError.id);
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      passwordError.id,
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("valida el formato del correo antes de enviar", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user, { email: "correo-invalido" });

    expect(
      await screen.findByText("Ingresá un correo electrónico válido."),
    ).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("normaliza espacios del correo y envía el contrato esperado al BFF", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user, { email: "  ana@example.com  " });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        body: {
          email: "ana@example.com",
          password: "secreto",
        },
      });
    });
  });

  it("no recorta ni transforma la contraseña", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user, { password: "  secreto  " });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          body: {
            email: "ana@example.com",
            password: "  secreto  ",
          },
        }),
      );
    });
  });

  it("permite mostrar y volver a ocultar la contraseña", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const passwordInput = screen.getByLabelText("Contraseña");

    await user.click(
      screen.getByRole("button", { name: "Mostrar contraseña" }),
    );
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    );
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("reemplaza por la raíz y refresca después de un login exitoso", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("respeta un destino interno seguro después del login", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/procesos?estado=ACTIVO" />);

    await completeValidForm(user);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/procesos?estado=ACTIVO");
    });
  });

  it("no entrega un destino externo al router", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="https://example.com/robo" />);

    await completeValidForm(user);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("muestra el mensaje exacto para credenciales inválidas y limpia solo la contraseña", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(401, { message: "Detalle que no debe mostrarse" }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo o la contraseña son incorrectos.",
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "ana@example.com",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("muestra el mensaje exacto cuando el backend no está disponible", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(503, { message: "Mensaje de infraestructura" }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El servidor no está disponible. Intentá nuevamente.",
    );
  });

  it("muestra otros errores ya normalizados por apiFetch", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(422, { message: "Revisá los datos ingresados." }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Revisá los datos ingresados.",
    );
  });

  it("no expone el detalle de un error no normalizado", async () => {
    apiFetchMock.mockRejectedValue(new Error("fetch failed at 127.0.0.1"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo iniciar sesión. Intentá nuevamente.",
    );
    expect(screen.queryByText(/127\.0\.0\.1/)).not.toBeInTheDocument();
  });

  it("deshabilita el envío duplicado mientras la solicitud está pendiente", async () => {
    let resolveRequest: ((value: LoginSuccessResponse) => void) | undefined;
    apiFetchMock.mockReturnValue(
      new Promise<LoginSuccessResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);

    const pendingButton = await screen.findByRole("button", {
      name: "Ingresando...",
    });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
    expect(screen.getByLabelText("Contraseña")).toBeDisabled();
    expect(apiFetchMock).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest?.(loginResponse);
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("retira el error de servidor cuando la persona corrige el formulario", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(401, { message: "Credenciales inválidas" }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await completeValidForm(user);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Contraseña"), "nuevo-secreto");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
