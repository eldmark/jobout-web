import { t, tf, type MessageKey } from "@/lib/messages";
import { offerErrorKey } from "@/lib/offers/errors";
import { formatWait } from "@/lib/offers/format";

/** Códigos del lado empresa -> mensaje en español; el resto, como en ofertas. Nunca texto técnico. */
export function companyErrorKey(status: number, error: string | null): MessageKey {
  switch (error) {
    case "empresa_no_verificada":
      return "company.error.unverified";
    case "membresia_vencida":
      return "company.error.expired";
    case "sin_permiso":
      return "company.error.noPermission";
    case "no_encontrado":
      return "company.error.notFound";
    case "invitacion_invalida":
      return "company.error.invitation";
    case "ya_tiene_empresa":
      return "company.error.alreadyMember";
    case "empresa_duplicada":
      return "company.error.duplicate";
    case "nit_inmutable":
      return "company.error.taxIdLocked";
    case "ultimo_administrador":
      return "company.error.lastAdmin";
    case "oferta_con_aplicaciones":
      return "company.error.offerFrozen";
    case "confidencial_inmutable":
      return "company.error.confidentialLocked";
    case "estado_invalido":
      return "company.error.state";
    case "oferta_incompleta":
      return "company.error.incomplete";
    case "demasiados_intentos":
      return "company.error.rateLimited";
  }
  if (status === 404) return "company.error.notFound";
  if (status === 429) return "company.error.rateLimited";
  return offerErrorKey(status, error);
}

export interface CompanyErrorInfo {
  status: number;
  error: string | null;
  retryAfter?: number | null;
}

/** Mensaje final: un 429 con `Retry-After` dice cuánto esperar. */
export function companyErrorText(e: CompanyErrorInfo): string {
  if (e.error === "demasiados_intentos" && e.retryAfter) return tf("company.error.rateLimitedIn", { wait: formatWait(e.retryAfter) });
  return t(companyErrorKey(e.status, e.error));
}
