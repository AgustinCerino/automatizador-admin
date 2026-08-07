"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/login-schema";
import type { LoginSuccessResponse } from "@/features/auth/types";
import { sanitizeInternalRedirect } from "@/lib/auth/redirect";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

const INVALID_CREDENTIALS_MESSAGE =
  "El correo o la contraseña son incorrectos.";
const SERVER_UNAVAILABLE_MESSAGE =
  "El servidor no está disponible. Intentá nuevamente.";
const GENERIC_LOGIN_ERROR_MESSAGE =
  "No se pudo iniciar sesión. Intentá nuevamente.";

interface LoginFormProps {
  nextPath?: string | null;
}

function getLoginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERIC_LOGIN_ERROR_MESSAGE;
  }

  if (error.status === 401) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (error.status === 503) {
    return SERVER_UNAVAILABLE_MESSAGE;
  }

  return error.message;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (credentials) => {
    setSubmitError(null);

    try {
      await apiFetch<LoginSuccessResponse>("/api/auth/login", {
        method: "POST",
        body: credentials,
      });

      router.replace(sanitizeInternalRedirect(nextPath));
      router.refresh();
    } catch (error) {
      setValue("password", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setSubmitError(getLoginErrorMessage(error));
    }
  });

  return (
    <form
      className="space-y-5"
      noValidate
      onChange={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={onSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">Correo electrónico</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email ? (
          <p id="login-email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            aria-invalid={Boolean(errors.password)}
            className="pr-10"
            disabled={isSubmitting}
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            aria-label={
              isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={isPasswordVisible}
            disabled={isSubmitting}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        {errors.password ? (
          <p id="login-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Ingresando...
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>
    </form>
  );
}
