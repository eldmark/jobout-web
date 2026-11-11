/**
 * Reenvío de entrevistas al backend (contrato simulado, Fase 3). Solo servidor. Mismo patrón
 * que CV: el navegador nunca ve el Bearer; de los errores solo pasan los códigos del contrato
 * y nunca texto del backend (el texto de la persona no debe aparecer en ninguna respuesta de error).
 */
import { forward, idParam, jsonBody, noEncontrado, UUID_RE } from "@/lib/cv/server";
import { errorJson } from "@/lib/auth/server";
import { countChars, MAX_ANSWER_CHARS } from "./types";

export { idParam, noEncontrado };

/** Errores permitidos por estado. Un texto = siempre ese código (el backend puede no mandar cuerpo). */
export const ERRORES_ENTREVISTA: Record<number, readonly string[] | string> = {
  403: ["nivel_bloqueado", "limite_del_plan", "cuenta_no_disponible"],
  404: ["no_encontrado"],
  409: ["nivel_no_disponible", "sesion_en_curso", "turno_en_proceso", "estado_invalido"],
  422: ["datos_invalidos", "entrevista_muy_corta"],
  429: "demasiados_intentos",
  503: "motor_no_disponible",
};

/** Campos extra que el contrato añade a algunos errores, con su formato: `session_id` (409 sesion_en_curso)
 * y `renews_at` (403 limite_del_plan, ISO 8601 con zona). Nada más cruza. */
const ECO = {
  session_id: UUID_RE,
  renews_at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/,
};

const ESTADOS = ["in_progress", "paused", "completed", "abandoned"];
const CURSOR_RE = /^[A-Za-z0-9_\-.~+/=]{1,512}$/;

type Modo = "json" | "none";

export function reenviar(request: Request, o: { method: string; path: string; body?: unknown; ok: Record<number, Modo> }) {
  return forward(request, {
    method: o.method,
    path: o.path,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    headers: o.body === undefined ? undefined : { "content-type": "application/json" },
    ok: o.ok,
    errors: ERRORES_ENTREVISTA,
    echo: ECO,
  });
}

/** Acción sin cuerpo sobre una sesión: valida el id antes de tocar el backend. */
export async function accion(request: Request, params: Promise<{ id: string }>, method: string, sufijo: string, ok: Record<number, Modo>) {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method, path: `/interviews/${id}${sufijo}`, ok });
}

/** `GET /interviews?limit&cursor&status`: valida y reenvía solo esos tres parámetros (422 sin tocar el backend). */
export async function listar(request: Request): Promise<Response> {
  const entrada = new URL(request.url).searchParams;
  const salida = new URLSearchParams();
  const limit = entrada.get("limit");
  if (limit !== null) {
    if (!/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) return errorJson(422, "datos_invalidos");
    salida.set("limit", limit);
  }
  const cursor = entrada.get("cursor");
  if (cursor !== null) {
    if (!CURSOR_RE.test(cursor)) return errorJson(422, "datos_invalidos");
    salida.set("cursor", cursor);
  }
  const status = entrada.get("status");
  if (status !== null) {
    if (!ESTADOS.includes(status)) return errorJson(422, "datos_invalidos");
    salida.set("status", status);
  }
  const query = salida.toString();
  return reenviar(request, { method: "GET", path: query ? `/interviews?${query}` : "/interviews", ok: { 200: "json" } });
}

export async function crear(request: Request): Promise<Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.recruiter_id !== "string" || typeof b.level_id !== "string" || !UUID_RE.test(b.recruiter_id) || !UUID_RE.test(b.level_id)) {
    return errorJson(422, "datos_invalidos");
  }
  // `job_offer_id` es opcional (práctica de una oferta): ausente o null = entrevista de siempre; otra cosa que un UUID, 422.
  const oferta = b.job_offer_id;
  if (oferta !== undefined && oferta !== null && (typeof oferta !== "string" || !UUID_RE.test(oferta))) return errorJson(422, "datos_invalidos");
  const body = { recruiter_id: b.recruiter_id, level_id: b.level_id, ...(typeof oferta === "string" ? { job_offer_id: oferta } : {}) };
  return reenviar(request, { method: "POST", path: "/interviews", body, ok: { 201: "json" } });
}

export async function enviarTurno(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.text !== "string") return errorJson(422, "datos_invalidos");
  // El contrato recorta y cuenta caracteres Unicode (no unidades UTF-16 ni bytes).
  const text = b.text.trim();
  if (text === "" || countChars(text) > MAX_ANSWER_CHARS) return errorJson(422, "datos_invalidos");
  return reenviar(request, { method: "POST", path: `/interviews/${id}/turns`, body: { text }, ok: { 201: "json" } });
}
