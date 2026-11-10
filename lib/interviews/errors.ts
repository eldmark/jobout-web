import { formatRenewal } from "./format";
import { t, tf, type MessageKey } from "@/lib/messages";

/** Código del contrato (o solo el estado HTTP) -> mensaje en español, sin texto técnico. */
export function interviewErrorKey(status: number, error: string | null): MessageKey {
  switch (error) {
    case "nivel_bloqueado":
      return "interview.error.levelLocked";
    case "limite_del_plan":
      return "interview.error.planLimit";
    case "cuenta_no_disponible":
      return "interview.error.forbidden";
    case "nivel_no_disponible":
      return "interview.error.levelUnavailable";
    case "sesion_en_curso":
      return "interview.error.activeSession";
    case "turno_en_proceso":
      return "interview.error.turnInProgress";
    case "estado_invalido":
      return "interview.error.state";
    case "entrevista_muy_corta":
      return "interview.error.tooShort";
    case "datos_invalidos":
      return "interview.error.invalid";
    case "demasiados_intentos":
      return "interview.error.rateLimited";
    case "motor_no_disponible":
      return "interview.error.engineDown";
    case "no_encontrado":
      return "interview.error.notFound";
  }
  switch (status) {
    case 403:
      return "interview.error.forbidden";
    case 404:
      return "interview.error.notFound";
    case 409:
      return "interview.error.state";
    case 422:
      return "interview.error.invalid";
    case 429:
      return "interview.error.rateLimited";
    case 503:
      return "interview.error.engineDown";
    default:
      return "interview.error.generic";
  }
}

/** Errores que tiene sentido reintentar con el mismo texto. */
export function isRetryable(status: number, error: string | null): boolean {
  return status === 0 || status === 429 || status === 503 || status >= 500 || error === "turno_en_proceso";
}

export interface ErrorInfo {
  status: number;
  error: string | null;
  /** `renews_at` de un 403 limite_del_plan (ISO 8601). */
  renewsAt?: string | null;
  /** `Retry-After` de un 429, en segundos. */
  retryAfter?: number | null;
}

/** Mensaje final en español: añade la fecha de renovación y la espera cuando el contrato las trae. */
export function interviewErrorText(e: ErrorInfo): string {
  if (e.error === "limite_del_plan" && e.renewsAt) {
    const date = formatRenewal(e.renewsAt);
    if (date) return tf("interview.error.planLimitRenews", { date });
  }
  if (e.error === "demasiados_intentos" && e.retryAfter) return tf("interview.error.rateLimitedIn", { n: e.retryAfter });
  return t(interviewErrorKey(e.status, e.error));
}
