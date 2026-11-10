/**
 * Contrato de entrevistas (Fase 3): `jobout-docs/documentation/api.md`, sección «Entrevista (Fase 3)».
 * Todo listado es `{items}`; solo `GET /interviews` pagina por cursor.
 */
export type InterviewStatus = "created" | "in_progress" | "paused" | "completed" | "abandoned";
/** La persona es `applicant` (enum `interview_speaker` de db.md). */
export type TurnSpeaker = "recruiter" | "applicant";
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
  /** Siempre presente: question | follow_up | closing del recruiter; answer de la persona. */
  kind: TurnKind;
  text: string;
}

export interface Interview {
  id: string;
  status: InterviewStatus;
  recruiter: { id: string; display_name: string; role_title: string };
  level: { id: string; code: string; name: string };
  /** ISO 8601 con zona. */
  created_at: string;
  turns: Turn[];
}

export interface InterviewSummary {
  id: string;
  status: InterviewStatus;
  level: { id: string; code: string; name: string };
  recruiter: { id: string; display_name: string };
  /** Nulo si la sesión no tiene score. */
  score: number | null;
  created_at: string;
  /** Nulo si la sesión no terminó. */
  completed_at: string | null;
}

/** Listados sin paginar: siempre `{items}`. */
export interface ItemsResponse<T> {
  items: T[];
}

/** `GET /interviews`: paginado por cursor opaco; `next_cursor` es null en la última página. */
export interface InterviewPage {
  items: InterviewSummary[];
  next_cursor: string | null;
}

export interface ListParams {
  /** 1–50 (defecto del backend: 20). */
  limit?: number;
  cursor?: string;
  status?: InterviewStatus;
}

export interface ResumeReply {
  /** Último turno del recruiter, para continuar sin repetir ni saltar preguntas. */
  turn: Turn;
}

export interface TurnReply {
  turn: Turn;
  done: boolean;
}

export interface CriterionScore {
  criterion: string;
  label: string;
  /** Puntos obtenidos (no un porcentaje). */
  score: number;
  max_points: number;
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
  /** Nombre del nivel. */
  level: string;
  /** `display_name` del recruiter. */
  recruiter: string;
  score: number;
}

export const MAX_ANSWER_CHARS = 4000;

/** El límite cuenta caracteres Unicode (puntos de código), no unidades UTF-16 ni bytes. */
export const countChars = (text: string): number => [...text].length;
