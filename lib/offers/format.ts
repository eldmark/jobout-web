/** Presentación de ofertas y aplicaciones: fechas de calendario, empresa, lugar y enlaces seguros. */
import { t, tf } from "@/lib/messages";
import { APPLICATION_STATUSES, EXTERNAL_STATUSES, type ApplicationStatus, type CatalogRef, type Company, type ExternalStatus } from "./types";

/** El estado de una aplicación en español; uno fuera del contrato da cadena vacía en vez de romper la página. */
export function applicationStatusLabel(s: string): string {
  return (APPLICATION_STATUSES as readonly string[]).includes(s) ? t(`applications.status.${s as ApplicationStatus}`) : "";
}

/** Ídem para el registro externo (su estado es libre, sin máquina). */
export function externalStatusLabel(s: string): string {
  return (EXTERNAL_STATUSES as readonly string[]).includes(s) ? t(`external.status.${s as ExternalStatus}`) : "";
}

const LOCALE = "es-GT";
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Una fecha `AAAA-MM-DD` (publicación, contratación, registro externo) es un día de calendario, no
 * un instante: se formatea en UTC para que en Guatemala no se corra al día anterior. Cadena vacía si
 * no es una fecha real.
 */
export function formatDay(ymd: string): string {
  const m = DIA.exec(ymd);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(y, mo - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== mo - 1 || fecha.getUTCDate() !== d) return "";
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(fecha);
}

/** Los segundos de `Retry-After` en minutos u horas, redondeando hacia arriba. */
export function formatWait(seconds: number): string {
  const minutos = Math.max(1, Math.ceil(seconds / 60));
  if (minutos < 60) return minutos === 1 ? t("offers.wait.minute") : tf("offers.wait.minutes", { n: minutos });
  const horas = Math.ceil(seconds / 3600);
  return horas === 1 ? t("offers.wait.hour") : tf("offers.wait.hours", { n: horas });
}

/** CA3: en el listado y el detalle públicos, una confidencial nunca muestra empresa, la mande o no la API. */
export function publicCompany(o: { confidential: boolean; company: Company | null }): Company | null {
  return o.confidential ? null : o.company;
}

/** AP9: en una aplicación, la empresa aparece solo si la API la devuelve (revelada al preseleccionar). */
export function revealedCompany(o: { confidential: boolean; company: Company | null }): Company | null {
  return o.company ?? null;
}

/** «Municipio, Departamento», o lo que haya. */
export function placeOf(o: { state: CatalogRef | null; city: CatalogRef | null }): string {
  return [o.city?.name, o.state?.name].filter(Boolean).join(", ");
}

/**
 * El sitio de una empresa lo escribe la empresa: solo se usa como enlace si es una URL absoluta
 * http(s). `javascript:`, `data:` o un texto suelto no son enlaces.
 */
export function safeWebsite(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url.trim())) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
