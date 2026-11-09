/** Llamadas del navegador al contrato simulado de entrevistas (/api/*). Nunca ven tokens. */
import { goTo } from "@/lib/navigate";
import type { Interview, InterviewScore, ResumeReply, InterviewSummary, Level, ProgressPoint, Recruiter, TurnReply } from "./types";

export interface Result<T> {
  status: number;
  data: T | null;
  error: string | null;
  /** Id de la sesión activa cuando el backend responde 409 sesion_en_curso. */
  sessionId: string | null;
}

async function call<T>(url: string, method = "GET", json?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    return { status: 0, data: null, error: null, sessionId: null };
  }
  if (res.status === 401) goTo("/sign-in");
  let cuerpo: unknown = null;
  try {
    const texto = await res.text();
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = null;
  }
  if (res.status >= 200 && res.status < 300) return { status: res.status, data: (cuerpo as T) ?? null, error: null, sessionId: null };
  const o = (cuerpo ?? {}) as { error?: unknown; session_id?: unknown };
  return {
    status: res.status,
    data: null,
    error: typeof o.error === "string" ? o.error : null,
    sessionId: typeof o.session_id === "string" ? o.session_id : null,
  };
}

const base = (id: string) => `/api/interviews/${id}`;

export const interviewsApi = {
  recruiters: () => call<Recruiter[]>("/api/recruiters"),
  levels: () => call<Level[]>("/api/levels"),
  progress: () => call<ProgressPoint[]>("/api/progress"),
  list: () => call<InterviewSummary[]>("/api/interviews"),
  create: (recruiterId: string, levelId: string) => call<Interview>("/api/interviews", "POST", { recruiter_id: recruiterId, level_id: levelId }),
  get: (id: string) => call<Interview>(base(id)),
  pause: (id: string) => call<null>(`${base(id)}/pause`, "POST"),
  resume: (id: string) => call<ResumeReply>(`${base(id)}/resume`, "POST"),
  abandon: (id: string) => call<null>(`${base(id)}/abandon`, "POST"),
  finish: (id: string) => call<InterviewScore>(`${base(id)}/finish`, "POST"),
  sendTurn: (id: string, text: string) => call<TurnReply>(`${base(id)}/turns`, "POST", { text }),
  score: (id: string) => call<InterviewScore>(`${base(id)}/score`),
  remove: (id: string) => call<null>(base(id), "DELETE"),
};
