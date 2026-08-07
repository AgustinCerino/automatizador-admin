import { Workflow } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { sanitizeInternalRedirect } from "@/lib/auth/redirect";
import {
  getServerSession,
  ServerSessionError,
} from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Iniciar sesión | Automatizador Administrativo",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const destination = sanitizeInternalRedirect(next);
  let authenticated = false;

  try {
    const session = await getServerSession();
    authenticated = session.authenticated;
  } catch (error) {
    if (!(error instanceof ServerSessionError)) {
      throw error;
    }
  }

  if (authenticated) {
    redirect(destination);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4 sm:p-6">
      <div className="w-full max-w-[27rem] space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Workflow aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Automatizador</p>
            <p className="text-sm text-muted-foreground">Administrativo</p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle>
              <h1 className="text-xl font-semibold">Iniciar sesión</h1>
            </CardTitle>
            <CardDescription>
              Ingresá tus credenciales para acceder a la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm nextPath={destination} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
