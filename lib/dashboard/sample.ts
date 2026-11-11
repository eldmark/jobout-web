/**
 * Valores de EJEMPLO para una cuenta que aún no practicó. Se pintan siempre con la etiqueta «Ejemplo»
 * y un texto para lectores de pantalla que dice que son ilustrativos: nunca se presentan como de la persona.
 */
import type { ProgressSummary } from "./stats";

export const SAMPLE_SUMMARY: ProgressSummary = {
  count: 4,
  average: 74,
  best: 86,
  last: 86,
  series: [58, 64, 61, 72, 79, 86],
  streak: 3,
  week: [
    { key: "ejemplo-1", done: false, today: false },
    { key: "ejemplo-2", done: true, today: false },
    { key: "ejemplo-3", done: true, today: false },
    { key: "ejemplo-4", done: false, today: false },
    { key: "ejemplo-5", done: true, today: false },
    { key: "ejemplo-6", done: true, today: false },
    { key: "ejemplo-7", done: true, today: true },
  ],
};
