/** Fechas legibles en es-GT. */
const LOCALE = "es-GT";

function valida(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha corta en la zona de la persona; cadena vacía si no es una fecha. */
export function formatDate(iso: string): string {
  const d = valida(iso);
  return d ? new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" }).format(d) : "";
}

/**
 * Día en que se renueva la cuota. El backend la cuenta por mes calendario UTC y manda el primer
 * instante del mes siguiente: se muestra el día UTC, no el local (en Guatemala sería el día anterior).
 */
export function formatRenewal(iso: string): string | null {
  const d = valida(iso);
  return d ? new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" }).format(d) : null;
}
