"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { UserMenu } from "@/features/auth/components/user-menu";
import type { CurrentUser } from "@/features/auth/types";
import { getNavigationItem } from "@/lib/navigation";

interface AppHeaderProps {
  user: CurrentUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const currentItem = getNavigationItem(pathname);

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-card">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <MobileNavigation />

        <nav
          aria-label="Ubicación actual"
          className="min-w-0 flex-1 overflow-hidden"
        >
          <ol className="flex min-w-0 items-center gap-2 text-sm">
            <li className="hidden shrink-0 text-muted-foreground sm:block">
              Automatizador Administrativo
            </li>
            <li aria-hidden="true" className="hidden sm:block">
              <ChevronRight className="size-4 text-muted-foreground" />
            </li>
            <li
              aria-current="page"
              className="truncate font-medium text-foreground"
            >
              {currentItem?.label ?? "Página"}
            </li>
          </ol>
        </nav>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
