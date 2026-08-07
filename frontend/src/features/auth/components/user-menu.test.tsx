import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "@/features/auth/components/user-menu";
import type { CurrentUser } from "@/features/auth/types";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

const CURRENT_USER: CurrentUser = {
  cliente_id: 23,
  email: "ana@empresa.test",
  estado: "ACTIVO",
  id: 17,
  nombre: "Ana Pérez",
  rol: "ADMIN",
};

function renderWithQueryClient(
  component: ReactElement,
): { clear: ReturnType<typeof vi.fn>; queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const clear = vi.fn();

  queryClient.clear = clear;

  render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>,
  );

  return { clear, queryClient };
}

async function openMenu(): Promise<void> {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /Abrir menú de usuario/i }),
  );
}

async function selectLogout(): Promise<void> {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("menuitem", { name: "Cerrar sesión" }),
  );
}

function createPendingPromise(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

describe("UserMenu", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(undefined);
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  it("muestra el nombre real y el rol en el disparador", () => {
    renderWithQueryClient(<UserMenu user={CURRENT_USER} />);

    const trigger = screen.getByRole("button", {
      name: "Abrir menú de usuario: Ana Pérez, rol ADMIN",
    });

    expect(trigger).toHaveTextContent("Ana Pérez");
    expect(trigger).toHaveTextContent("ADMIN");
  });

  it("usa el correo como nombre visible cuando el nombre está vacío", () => {
    renderWithQueryClient(
      <UserMenu user={{ ...CURRENT_USER, nombre: "   " }} />,
    );

    expect(
      screen.getByRole("button", {
        name: "Abrir menú de usuario: ana@empresa.test, rol ADMIN",
      }),
    ).toHaveTextContent("ana@empresa.test");
  });

  it("muestra correo y rol literales sin exponer otros datos del usuario", async () => {
    renderWithQueryClient(<UserMenu user={CURRENT_USER} />);

    await openMenu();
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("ana@empresa.test")).toBeInTheDocument();
    expect(within(menu).getByText("Rol: ADMIN")).toBeInTheDocument();
    expect(within(menu).queryByText("ACTIVO")).not.toBeInTheDocument();
    expect(within(menu).queryByText("23")).not.toBeInTheDocument();
    expect(within(menu).queryByText("17")).not.toBeInTheDocument();
  });

  it("solicita el logout al BFF con una respuesta vacía", async () => {
    renderWithQueryClient(<UserMenu user={CURRENT_USER} />);

    await openMenu();
    await selectLogout();

    expect(mocks.apiFetch).toHaveBeenCalledOnce();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      responseType: "void",
    });
  });

  it("limpia la caché y navega al login después del logout", async () => {
    const { clear } = renderWithQueryClient(
      <UserMenu user={CURRENT_USER} />,
    );

    await openMenu();
    await selectLogout();

    await waitFor(() => {
      expect(clear).toHaveBeenCalledOnce();
      expect(mocks.replace).toHaveBeenCalledWith("/login");
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });
  });

  it("bloquea solicitudes duplicadas mientras el logout está pendiente", async () => {
    const pendingLogout = createPendingPromise();
    mocks.apiFetch.mockReturnValue(pendingLogout.promise);
    renderWithQueryClient(<UserMenu user={CURRENT_USER} />);

    await openMenu();
    const user = userEvent.setup();
    const logoutItem = await screen.findByRole("menuitem", {
      name: "Cerrar sesión",
    });

    await user.click(logoutItem);
    expect(
      screen.getByRole("menuitem", { name: "Cerrando sesión..." }),
    ).toHaveAttribute("data-disabled");
    await user.click(
      screen.getByRole("menuitem", { name: "Cerrando sesión..." }),
    );

    expect(mocks.apiFetch).toHaveBeenCalledOnce();
    pendingLogout.resolve();
  });

  it("muestra un error controlado y conserva la caché si falla el logout", async () => {
    mocks.apiFetch.mockRejectedValue(
      new Error("token secreto en http://backend-interno/auth/logout"),
    );
    const { clear } = renderWithQueryClient(
      <UserMenu user={CURRENT_USER} />,
    );

    await openMenu();
    await selectLogout();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cerrar la sesión. Intentá nuevamente.",
    );
    expect(screen.queryByText(/token secreto/i)).not.toBeInTheDocument();
    expect(clear).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
