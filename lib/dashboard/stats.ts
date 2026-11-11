/**
 * Agregados del panel de la persona candidata, a partir de `GET /progress` (sesiones completadas con
 * su fecha y puntaje 0–100). Todo es puro: el «ahora» y la zona horaria entran como argumentos, así
 * la racha se cuenta en los días de la persona y no en los del servidor.
 */
import type { ProgressPoint } from "@/lib/interviews/types";

export interface WeekDay {
  key: string;
  done: boolean;
  today: boolean;
}

export interface ProgressSummary {
  count: number;
  average: number | null;
  best: number | null;
  last: number | null;
  /** Últimos puntajes en orden cronológico, para el gráfico pequeño. */
  series: number[];
  /** Días seguidos con al menos una práctica; sigue viva si la última fue ayer. */
  streak: number;
  /** Siete días, de hace seis a hoy. */
  week: WeekDay[];
}

export const SERIES_LENGTH = 12;
const DAY_MS = 86_400_000;

/** `AAAA-MM-DD` de un instante en esa zona horaria; null si la fecha no existe. */
export function dayKey(when: string | Date, timeZone: string): string | null {
  const d = typeof when === "string" ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** El día anterior de una clave `AAAA-MM-DD`, sin depender de ninguna zona horaria. */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function summarize(points: readonly ProgressPoint[], now: Date, timeZone = "UTC"): ProgressSummary {
  const valid = points
    .filter((p) => Number.isFinite(p.score) && !Number.isNaN(new Date(p.completed_at).getTime()))
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
  const days = new Set(valid.map((p) => dayKey(p.completed_at, timeZone)!));
  const today = dayKey(now, timeZone) ?? dayKey(now, "UTC")!;

  const week: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = shiftKey(today, i - 6);
    return { key, done: days.has(key), today: key === today };
  });

  let streak = 0;
  let cursor = days.has(today) ? today : shiftKey(today, -1);
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }

  const scores = valid.map((p) => p.score);
  return {
    count: valid.length,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    best: scores.length ? Math.max(...scores) : null,
    last: scores.length ? scores[scores.length - 1] : null,
    series: scores.slice(-SERIES_LENGTH),
    streak,
    week,
  };
}

export interface CompletionSteps {
  cv: boolean | null;
  skills: boolean | null;
  practice: boolean | null;
  application: boolean | null;
}

/** Avance de los primeros pasos. Un paso que no se pudo saber (null) no cuenta como hecho. */
export function completion(steps: CompletionSteps): { done: number; total: number; percent: number } {
  const values = Object.values(steps);
  const done = values.filter((v) => v === true).length;
  return { done, total: values.length, percent: Math.round((done / values.length) * 100) };
}
