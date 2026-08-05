import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        className="sr-only z-50 rounded-md bg-card px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-ring"
        href="#contenido-principal"
      >
        Ir al contenido principal
      </a>
      <AppSidebar />
      <div className="min-w-0">
        <AppHeader />
        <main
          className="min-h-[calc(100svh-4rem)]"
          id="contenido-principal"
        >
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
