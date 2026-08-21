"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AppBrand } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isNavigationItemActive,
  navigationItems,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 1024px)");

    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) {
        setOpen(false);
      }
    }

    desktopBreakpoint.addEventListener("change", closeOnDesktop);

    return () => {
      desktopBreakpoint.removeEventListener("change", closeOnDesktop);
    };
  }, []);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label="Abrir navegación"
          className="lg:hidden"
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground"
        side="left"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navegación</SheetTitle>
          <SheetDescription>
            Accesos principales del Automatizador Administrativo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-primary/30 px-5 pr-12">
          <AppBrand className="w-full" onNavigate={() => setOpen(false)} />
        </div>
        <nav aria-label="Navegación móvil" className="px-3 py-5">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = isNavigationItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-primary/10 hover:text-sidebar-primary",
                    )}
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-5 shrink-0",
                        isActive
                          ? "text-sidebar-primary-foreground"
                          : "text-sidebar-primary",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
