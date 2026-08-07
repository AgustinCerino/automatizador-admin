import { z } from "zod";

import type { LoginRequest } from "@/features/auth/types";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresá tu correo electrónico.")
    .email("Ingresá un correo electrónico válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
}) satisfies z.ZodType<LoginRequest>;

export type LoginFormValues = z.infer<typeof loginSchema>;
