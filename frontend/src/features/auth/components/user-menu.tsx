"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleUserRound, LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/features/auth/types";
import { apiFetch } from "@/lib/api/client";

const LOGOUT_ERROR_MESSAGE =
  "No se pudo cerrar la sesión. Intentá nuevamente.";

interface UserMenuProps {
  user: CurrentUser;
}

function getDisplayName(user: CurrentUser): string {
  const normalizedName = user.nombre.trim();
  return normalizedName.length > 0 ? normalizedName : user.email;
}

export function UserMenu({ user }: UserMenuProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const logoutInFlight = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const displayName = getDisplayName(user);

  async function handleLogout(): Promise<void> {
    if (logoutInFlight.current) {
      return;
    }

    logoutInFlight.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      await apiFetch<void>("/api/auth/logout", {
        method: "POST",
        responseType: "void",
      });

      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError(LOGOUT_ERROR_MESSAGE);
    } finally {
      logoutInFlight.current = false;
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Abrir menú de usuario: ${displayName}, rol ${user.rol}`}
          className="h-11 min-w-0 max-w-52 justify-start gap-2 px-2"
          type="button"
          variant="ghost"
        >
          <CircleUserRound aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-xs font-medium sm:text-sm">
              {displayName}
            </span>
            <span className="block truncate text-[0.65rem] font-normal text-muted-foreground sm:text-xs">
              {user.rol}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-64">
        <div className="space-y-1 px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.email}</p>
          <p className="text-xs text-muted-foreground">Rol: {user.rol}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          variant="destructive"
        >
          {isLoggingOut ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </DropdownMenuItem>

        {logoutError ? (
          <p
            className="px-2 py-1.5 text-xs text-destructive"
            role="alert"
          >
            {logoutError}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
