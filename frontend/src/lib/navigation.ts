import {
  Files,
  House,
  ListChecks,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavigationHref =
  | "/"
  | "/procesos"
  | "/ejecuciones"
  | "/plantillas";

export interface NavigationItem {
  label: string;
  href: NavigationHref;
  icon: LucideIcon;
  description?: string;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    label: "Inicio",
    href: "/",
    icon: House,
    description: "Vista general de la plataforma.",
  },
  {
    label: "Procesos",
    href: "/procesos",
    icon: Workflow,
    description: "Organizá los procesos administrativos de la plataforma.",
  },
  {
    label: "Ejecuciones",
    href: "/ejecuciones",
    icon: ListChecks,
    description: "Consultá el avance y los resultados de cada ejecución.",
  },
  {
    label: "Plantillas",
    href: "/plantillas",
    icon: Files,
    description: "Administrá las plantillas que estructuran las automatizaciones.",
  },
] as const;

export function isNavigationItemActive(
  pathname: string,
  href: NavigationHref,
) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavigationItem(pathname: string) {
  return navigationItems.find((item) =>
    isNavigationItemActive(pathname, item.href),
  );
}
