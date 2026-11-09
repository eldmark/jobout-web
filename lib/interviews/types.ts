/**
 * Contrato SIMULADO de entrevistas (Fase 3, paso 3). El backend aún no existe: estas formas
 * salen de `docs/working/fase3-entrevista.md` y se confirman en el paso 11.
 */
export type InterviewStatus = "created" | "in_progress" | "paused" | "completed" | "abandoned";
export type TurnSpeaker = "recruiter" | "candidate";
export type TurnKind = "question" | "follow_up" | "closing" | "answer";

export interface Recruiter {
  id: string;
  code: string;
  display_name: string;
  role_title: string;
  personality: string;
  language: string;
}

export interface Level {
  id: string;
  code: string;
  name: string;
  /** 1..5, de Junior a McKinsey. */
  position: number;
  /** false = el nivel existe pero todavía no tiene banco de preguntas. */
  available: boolean;
  unlocked: boolean;
  min_score_to_unlock: number | null;
  best_score: number | null;
  sessions_completed: number;
}

export interface Turn {
  seq: number;
  speaker: TurnSpeaker;
  kind?: TurnKind;
  text: string;
}

export interface Interview {
  id: string;
  status: InterviewStatus;
  recruiter: { id: string; display_name: string; role_title: string };
  level: { id: string; code: string; name: string };
  turns: Turn[];
}

export interface InterviewSummary {
  id: string;
  status: InterviewStatus;
  level: { id: string; code: string; name: string };
  recruiter: { id: string; display_name: string };
  score?: number | null;
}

export interface TurnReply {
  turn: Turn;
  done: boolean;
}

export interface CriterionScore {
  criterion: string;
  label: string;
  score: number;
  why: string;
}

export interface InterviewScore {
  score: number;
  clarity: number;
  /** Nula en modo texto: no hay señales de voz. */
  confidence: number | null;
  breakdown: CriterionScore[];
  improvements: string[];
  rubric_version: number;
  computed_at: string;
}

export interface ProgressPoint {
  session_id: string;
  completed_at: string;
  level: string;
  recruiter: string;
  score: number;
}

export const MAX_ANSWER_CHARS = 4000;
