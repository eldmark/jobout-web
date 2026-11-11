/** Registro privado de aplicaciones externas (HU-32): validación antes de enviar, con los topes del backend. */
import type { MessageKey } from "@/lib/messages";
import { countChars } from "@/lib/interviews/types";
import { formatDay } from "./format";
import { EXTERNAL_LIMITS, EXTERNAL_STATUSES, type ExternalInput, type ExternalStatus } from "./types";

/** El formulario tal como lo escribe la persona (todo texto). */
export interface ExternalForm {
  company_name: string;
  position: string;
  applied_on: string;
  status: string;
  notes: string;
}

export type ExternalField = keyof ExternalForm;
export type ExternalErrors = Partial<Record<ExternalField, MessageKey>>;

const dos = (n: number) => String(n).padStart(2, "0");

/** La fecha de hoy en la zona de la persona, `AAAA-MM-DD` (el máximo del selector de fecha). */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${dos(now.getMonth() + 1)}-${dos(now.getDate())}`;
}

/** Cinco años antes; un 29 de febrero cae en el 28 si ese año no es bisiesto (igual que el backend). */
export function fiveYearsBefore(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const anio = y - EXTERNAL_LIMITS.years;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return `${anio}-${dos(m)}-${dos(m === 2 && d === 29 && !bisiesto ? 28 : d)}`;
}

const nombreValido = (s: string) => {
  const n = countChars(s.trim());
  return n >= EXTERNAL_LIMITS.nameMin && n <= EXTERNAL_LIMITS.nameMax;
};

/** Errores por campo (vacío si todo está bien). `today` es `AAAA-MM-DD`. */
export function validateExternal(f: ExternalForm, today: string): ExternalErrors {
  const e: ExternalErrors = {};
  if (!nombreValido(f.company_name)) e.company_name = "external.error.company";
  if (!nombreValido(f.position)) e.position = "external.error.position";
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  if (!formatDay(f.applied_on) || f.applied_on > today || f.applied_on < fiveYearsBefore(today)) e.applied_on = "external.error.appliedOn";
  if (!(EXTERNAL_STATUSES as readonly string[]).includes(f.status)) e.status = "external.error.status";
  if (countChars(f.notes.trim()) > EXTERNAL_LIMITS.notesMax) e.notes = "external.error.notes";
  return e;
}

/** Lo que viaja: textos recortados y unas notas vacías como null. */
export function toExternalInput(f: ExternalForm): ExternalInput {
  const notas = f.notes.trim();
  return {
    company_name: f.company_name.trim(),
    position: f.position.trim(),
    applied_on: f.applied_on,
    status: f.status as ExternalStatus,
    notes: notas === "" ? null : notas,
  };
}
