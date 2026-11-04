import type { MessageKey } from "@/lib/messages";

export type AuthForm = "register" | "login";

/** Estado HTTP / código del backend -> mensaje. No agrega detalle que el backend no dé. */
export function authErrorKey(status: number, form: AuthForm): MessageKey {
  if (status === 409) return "auth.error.registerUnavailable";
  if (status === 401) return form === "login" ? "auth.error.invalidCredentials" : "auth.error.generic";
  if (status === 403) return "auth.error.accountUnavailable";
  if (status === 429) return "auth.error.tooManyAttempts";
  if (status === 422) return "auth.error.invalidData";
  return "auth.error.generic";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Campo = "first_name" | "last_name" | "email" | "password";
export type ErroresCampo = Partial<Record<Campo, MessageKey>>;
export type ValoresCampo = Record<Campo, string>;
