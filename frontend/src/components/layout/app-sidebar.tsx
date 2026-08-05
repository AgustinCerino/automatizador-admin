"use client";

import { CircleUserRound, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavigationItemActive,
  navigationItems,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface AppBrandProps {
  className?: string;
  onNavigate?: () => void;
}

export function AppBrand({ className, onNavigate }: AppBrandProps) {
  return (
    <Link
      className={cn(
        "flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2",
        className,
      )}
      href="/"
      onClick={onNavigate}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Workflow aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-sidebar-foreground">
          Automatizador
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          Administración
        </span>
      </span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <AppBrand className="w-full" />
      </div>

      <nav aria-label="Navegación principal" className="flex-1 px-3 py-5">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = isNavigationItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                  href={item.href}
                >
                  <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="m-3 rounded-lg border border-sidebar-border bg-muted/50 p-3">
        <div
          aria-label="Área de sesión reservada"
          className="flex items-center gap-3"
        >
          <CircleUserRound
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Sesión</p>
            <p className="truncate text-xs text-muted-foreground">
              Disponible próximamente
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
