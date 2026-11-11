import { t, tf, type MessageKey } from "@/lib/messages";
import { formatWait } from "./format";

/** Código del contrato de ofertas y aplicaciones (o solo el estado HTTP) -> mensaje en español, sin texto técnico. */
export function offerErrorKey(status: number, error: string | null): MessageKey {
  switch (error) {
    case "consentimiento_requerido":
      return "offers.error.consent";
    case "ya_aplicaste":
      return "offers.error.alreadyApplied";
    case "oferta_propia":
      return "offers.error.ownOffer";
    case "estado_invalido":
      return "offers.error.state";
    case "limite_de_registros":
      return "offers.error.externalLimit";
    case "datos_invalidos":
    case "campo_no_permitido":
    case "parametro_no_permitido":
      return "offers.error.invalid";
    case "demasiados_intentos":
      return "offers.error.rateLimited";
    case "cuenta_no_disponible":
      return "offers.error.forbidden";
    case "no_encontrado":
      return "offers.error.notFound";
  }
  switch (status) {
    case 403:
      return "offers.error.forbidden";
    case 404:
      return "offers.error.notFound";
    case 409:
      return "offers.error.state";
    case 422:
      return "offers.error.invalid";
    case 429:
      return "offers.error.rateLimited";
    default:
      return "offers.error.generic";
  }
}

export interface OfferErrorInfo {
  status: number;
  error: string | null;
  /** `Retry-After` de un 429, en segundos. */
  retryAfter?: number | null;
}

/** Mensaje final: un 429 con `Retry-After` dice cuánto esperar. */
export function offerErrorText(e: OfferErrorInfo): string {
  if (e.error === "demasiados_intentos" && e.retryAfter) return tf("offers.error.rateLimitedIn", { wait: formatWait(e.retryAfter) });
  return t(offerErrorKey(e.status, e.error));
}
