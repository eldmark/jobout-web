/**
 * Decisiones de presentación del panel de la persona candidata, sin JSX: qué se muestra, con qué
 * valores (reales o de ejemplo) y cuál es el siguiente paso. Así el componente solo dibuja.
 */
import type { ProgressPoint } from "@/lib/interviews/types";
import type { MessageKey } from "@/lib/messages";
import { SAMPLE_SUMMARY } from "./sample";
import { completion, summarize, type ProgressSummary } from "./stats";

export type Paso = "cv" | "skills" | "practice" | "application";

export const SIGUIENTE: Record<Paso, { key: MessageKey; href: string }> = {
  cv: { key: "dashboard.completion.cv", href: "/profile/cv" },
  skills: { key: "dashboard.completion.skills", href: "/profile" },
  practice: { key: "dashboard.completion.practice", href: "/interviews" },
  application: { key: "dashboard.completion.application", href: "/offers" },
};

export interface CandidateInput {
  points: ProgressPoint[] | null;
  applications: number | null;
  hasCv: boolean | null;
  hasSkills: boolean | null;
}

export interface CandidateView {
  /** false = no se pudo leer el progreso: no se pintan las piezas de práctica. */
  showPractice: boolean;
  /** true = los números de práctica son de ejemplo (cuenta sin prácticas): van etiquetados. */
  sample: boolean;
  summary: ProgressSummary;
  streakHint: MessageKey;
  completion: { done: number; total: number; percent: number };
  nextStep: Paso | null;
  showCompletion: boolean;
}

export function candidateView(input: CandidateInput, now: Date, timeZone: string): CandidateView {
  const real = summarize(input.points ?? [], now, timeZone);
  const sample = input.points !== null && real.count === 0;
  const summary: ProgressSummary = sample ? { ...SAMPLE_SUMMARY, week: real.week.map((d, i) => ({ ...d, done: SAMPLE_SUMMARY.week[i].done })) } : real;
  const pasos: Record<Paso, boolean | null> = {
    cv: input.hasCv,
    skills: input.hasSkills,
    practice: input.points === null ? null : real.count !== 0,
    application: input.applications === null ? null : input.applications !== 0,
  };
  const claves = Object.keys(pasos) as Paso[];
  let streakHint: MessageKey = "dashboard.streak.keepHint";
  if (summary.streak === 0) streakHint = "dashboard.streak.startHint";
  else if (summary.week[summary.week.length - 1].done) streakHint = "dashboard.streak.doneHint";
  return {
    showPractice: input.points !== null,
    sample,
    summary,
    streakHint,
    completion: completion(pasos),
    nextStep: claves.find((k) => pasos[k] === false) ?? null,
    showCompletion: claves.some((k) => pasos[k] !== null),
  };
}

/** Texto del día en español (`narrow`: «L», `long`: «lunes»), a partir de una clave `AAAA-MM-DD`. */
export function weekdayLabel(key: string, style: "narrow" | "long"): string {
  return new Intl.DateTimeFormat("es", { weekday: style, timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
}
