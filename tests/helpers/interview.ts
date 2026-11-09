/** Datos de ejemplo del contrato simulado de entrevistas (Fase 3, paso 3). */
export const SID = "22222222-2222-4222-8222-222222222222";
export const REC_ID = "33333333-3333-4333-8333-333333333333";
export const LVL_ID = "44444444-4444-4444-8444-444444444444";

export const RECRUITERS = [
  { id: REC_ID, code: "ana", display_name: "Ana", role_title: "Reclutadora de talento", personality: "Cercana y paciente", language: "es" },
  { id: "33333333-3333-4333-8333-333333333334", code: "martin", display_name: "Martín", role_title: "Líder técnico", personality: "Directo y exigente", language: "es" },
];

export const LEVELS = [
  { id: LVL_ID, code: "junior", name: "Junior", position: 1, available: true, unlocked: true, min_score_to_unlock: null, best_score: 72, sessions_completed: 3 },
  { id: "44444444-4444-4444-8444-444444444441", code: "startup", name: "Startup", position: 2, available: true, unlocked: false, min_score_to_unlock: 60, best_score: null, sessions_completed: 0 },
  { id: "44444444-4444-4444-8444-444444444442", code: "amazon", name: "Amazon", position: 3, available: false, unlocked: false, min_score_to_unlock: 70, best_score: null, sessions_completed: 0 },
  { id: "44444444-4444-4444-8444-444444444443", code: "google", name: "Google", position: 4, available: false, unlocked: false, min_score_to_unlock: 75, best_score: null, sessions_completed: 0 },
  { id: "44444444-4444-4444-8444-444444444444", code: "mckinsey", name: "McKinsey", position: 5, available: false, unlocked: false, min_score_to_unlock: 80, best_score: null, sessions_completed: 0 },
];

export const T1 = { seq: 1, speaker: "recruiter", kind: "question", text: "Cuéntame sobre un proyecto del que te sientas orgulloso." };

export const SESION = (over: Record<string, unknown> = {}) => ({
  id: SID,
  status: "in_progress",
  recruiter: { id: REC_ID, display_name: "Ana", role_title: "Reclutadora de talento" },
  level: { id: LVL_ID, code: "junior", name: "Junior" },
  turns: [T1],
  ...over,
});

export const SCORE = (over: Record<string, unknown> = {}) => ({
  score: 78,
  clarity: 81,
  confidence: null,
  breakdown: [
    { criterion: "structure", label: "Estructura de la respuesta", score: 85, why: "Ordenaste tu historia en situación, acción y resultado." },
    { criterion: "examples", label: "Ejemplos concretos", score: 60, why: "Faltaron cifras o resultados medibles." },
  ],
  improvements: ["Añade un resultado medible a cada historia.", "Menciona qué decidiste tú y no solo el equipo."],
  rubric_version: 1,
  computed_at: "2026-11-09T10:00:00Z",
  ...over,
});

export const PROGRESO = [
  { session_id: "a", completed_at: "2026-11-01T10:00:00Z", level: "Junior", recruiter: "Ana", score: 60 },
  { session_id: "b", completed_at: "2026-11-05T10:00:00Z", level: "Junior", recruiter: "Martín", score: 72 },
];
