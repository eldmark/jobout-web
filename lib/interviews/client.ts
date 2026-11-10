/** Llamadas del navegador al contrato de entrevistas (/api/*). Nunca ven tokens. */
import { goTo } from "@/lib/navigate";
import type { Interview, InterviewPage, InterviewScore, ItemsResponse, ListParams, Level, ProgressPoint, Recruiter, ResumeReply, TurnReply } from "./types";

export interface Result<T> {
  status: number;
  data: T | null;
  error: string | null;
  /** Id de la sesión activa cuando el backend responde 409 sesion_en_curso. */
  sessionId: string | null;
  /** `renews_at` de un 403 limite_del_plan (ISO 8601). */
  renewsAt: string | null;
  /** `Retry-After` de un 429, en segundos. */
  retryAfter: number | null;
}

/** true para cualquier 2xx. */
export const isOk = (status: number): boolean => status >= 200 && status < 300;

async function call<T>(url: string, method = "GET", json?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    return { status: 0, data: null, error: null, sessionId: null, renewsAt: null, retryAfter: null };
  }
  if (res.status === 401) goTo("/sign-in");
  let cuerpo: unknown = null;
  try {
    const texto = await res.text();
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = null;
  }
  if (isOk(res.status)) return { status: res.status, data: (cuerpo as T) ?? null, error: null, sessionId: null, renewsAt: null, retryAfter: null };
  const o = (cuerpo ?? {}) as { error?: unknown; session_id?: unknown; renews_at?: unknown };
  const espera = res.headers.get("retry-after");
  return {
    status: res.status,
    data: null,
    error: typeof o.error === "string" ? o.error : null,
    sessionId: typeof o.session_id === "string" ? o.session_id : null,
    renewsAt: typeof o.renews_at === "string" ? o.renews_at : null,
    retryAfter: espera && /^\d{1,6}$/.test(espera) ? Number(espera) : null,
  };
}

function queryDe(p: ListParams): string {
  const q = new URLSearchParams();
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  if (p.cursor !== undefined) q.set("cursor", p.cursor);
  if (p.status !== undefined) q.set("status", p.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

const base = (id: string) => `/api/interviews/${id}`;

export const interviewsApi = {
  recruiters: () => call<ItemsResponse<Recruiter>>("/api/recruiters"),
  levels: () => call<ItemsResponse<Level>>("/api/levels"),
  progress: () => call<ItemsResponse<ProgressPoint>>("/api/progress"),
  list: (params: ListParams = {}) => call<InterviewPage>(`/api/interviews${queryDe(params)}`),
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
