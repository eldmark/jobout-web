/**
 * Reenvío de entrevistas al backend (contrato simulado, Fase 3). Solo servidor. Mismo patrón
 * que CV: el navegador nunca ve el Bearer; de los errores solo pasan los códigos del contrato
 * y nunca texto del backend (el texto de la persona no debe aparecer en ninguna respuesta de error).
 */
import { forward, idParam, jsonBody, noEncontrado, UUID_RE } from "@/lib/cv/server";
import { errorJson } from "@/lib/auth/server";
import { MAX_ANSWER_CHARS } from "./types";

export { idParam, noEncontrado };

/** Errores permitidos por estado. Un texto = siempre ese código (el backend puede no mandar cuerpo). */
export const ERRORES_ENTREVISTA: Record<number, readonly string[] | string> = {
  403: ["nivel_bloqueado", "cuenta_no_disponible"],
  404: ["no_encontrado"],
  409: ["nivel_no_disponible", "sesion_en_curso", "turno_en_proceso", "estado_invalido"],
  422: ["datos_invalidos", "entrevista_muy_corta"],
  429: "demasiados_intentos",
  503: "motor_no_disponible",
};

type Modo = "json" | "none";

export function reenviar(request: Request, o: { method: string; path: string; body?: unknown; ok: Record<number, Modo> }) {
  return forward(request, {
    method: o.method,
    path: o.path,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    headers: o.body === undefined ? undefined : { "content-type": "application/json" },
    ok: o.ok,
    errors: ERRORES_ENTREVISTA,
    echo: ["session_id"],
  });
}

/** Acción sin cuerpo sobre una sesión: valida el id antes de tocar el backend. */
export async function accion(request: Request, params: Promise<{ id: string }>, method: string, sufijo: string, ok: Record<number, Modo>) {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method, path: `/interviews/${id}${sufijo}`, ok });
}

export async function crear(request: Request): Promise<Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.recruiter_id !== "string" || typeof b.level_id !== "string" || !UUID_RE.test(b.recruiter_id) || !UUID_RE.test(b.level_id)) {
    return errorJson(422, "datos_invalidos");
  }
  return reenviar(request, { method: "POST", path: "/interviews", body: { recruiter_id: b.recruiter_id, level_id: b.level_id }, ok: { 201: "json" } });
}

export async function enviarTurno(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  const text = b.text;
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_ANSWER_CHARS) return errorJson(422, "datos_invalidos");
  return reenviar(request, { method: "POST", path: `/interviews/${id}/turns`, body: { text }, ok: { 201: "json" } });
}
