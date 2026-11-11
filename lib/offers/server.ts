/**
 * Reenvío de ofertas, aplicaciones y registros externos al backend (Fase 5a). Solo servidor. Mismo
 * patrón que entrevistas: el navegador nunca ve el Bearer; lo que no cumple el contrato se rechaza
 * aquí con 422 sin tocar el backend; de los errores solo pasan los códigos del contrato y dos ecos
 * validados por formato (`application_id` UUID y `status` de la máquina). Nunca el texto del backend,
 * que podría nombrar a una empresa confidencial.
 */
import { forward, idParam, jsonBody, noEncontrado, UUID_RE } from "@/lib/cv/server";
import { errorJson } from "@/lib/auth/server";
import { APPLICATION_STATUSES, EXTERNAL_STATUSES, MANDATORY_FIELDS, OFFER_FILTERS, OFFER_SORTS, SHARED_FIELDS } from "./types";

/** Errores permitidos por estado (`api.md`, «Códigos de error del grupo», lo que toca al candidato). */
export const ERRORES_OFERTAS: Record<number, readonly string[] | string> = {
  403: ["cuenta_no_disponible"],
  404: ["no_encontrado"],
  409: ["ya_aplicaste", "oferta_propia", "estado_invalido", "limite_de_registros"],
  422: ["datos_invalidos", "campo_no_permitido", "parametro_no_permitido", "consentimiento_requerido"],
  429: "demasiados_intentos",
};

const ECO = {
  application_id: UUID_RE,
  status: new RegExp(`^(${APPLICATION_STATUSES.join("|")})$`),
};

const CURSOR_RE = /^[A-Za-z0-9_\-.~+/=]{1,512}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

type Modo = "json" | "none";

function reenviar(request: Request, o: { method: string; path: string; body?: unknown; ok: Record<number, Modo> }) {
  return forward(request, {
    method: o.method,
    path: o.path,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    headers: o.body === undefined ? undefined : { "content-type": "application/json" },
    ok: o.ok,
    errors: ERRORES_OFERTAS,
    echo: ECO,
  });
}

/** Copia a `salida` limit (1–50), cursor y, si se pasa la lista, status. null = algo no es válido. */
function paginacion(entrada: URLSearchParams, salida: URLSearchParams, estados?: readonly string[]): URLSearchParams | null {
  const limit = entrada.get("limit");
  if (limit !== null) {
    if (!/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) return null;
    salida.set("limit", limit);
  }
  const cursor = entrada.get("cursor");
  if (cursor !== null) {
    if (!CURSOR_RE.test(cursor)) return null;
    salida.set("cursor", cursor);
  }
  if (estados) {
    const status = entrada.get("status");
    if (status !== null) {
      if (!estados.includes(status)) return null;
      salida.set("status", status);
    }
  }
  return salida;
}

const conQuery = (path: string, q: URLSearchParams) => (q.toString() ? `${path}?${q}` : path);

/**
 * `GET /offers`: solo limit, cursor, sort y los ocho filtros (ids de catálogo, una vez cada uno).
 * Cualquier otro parámetro (edad, género, nombre, empresa, texto…) no se reenvía nunca.
 */
export async function listarOfertas(request: Request): Promise<Response> {
  const entrada = new URL(request.url).searchParams;
  const salida = paginacion(entrada, new URLSearchParams());
  if (!salida) return errorJson(422, "datos_invalidos");
  const sort = entrada.get("sort");
  if (sort !== null) {
    if (!(OFFER_SORTS as readonly string[]).includes(sort)) return errorJson(422, "datos_invalidos");
    salida.set("sort", sort);
  }
  for (const f of OFFER_FILTERS) {
    const valores = entrada.getAll(f);
    if (valores.length === 0) continue;
    if (valores.length > 1 || !UUID_RE.test(valores[0])) return errorJson(422, "datos_invalidos");
    salida.set(f, valores[0]);
  }
  return reenviar(request, { method: "GET", path: conQuery("/offers", salida), ok: { 200: "json" } });
}

export async function leerOferta(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method: "GET", path: `/offers/${id}`, ok: { 200: "json" } });
}

/**
 * Aplicar (AP1, AP2). El consentimiento es el booleano `true` y nada más: cualquier otra cosa es 422
 * `consentimiento_requerido` sin tocar el backend. Viajan solo `consent` y `shared_fields`.
 */
export async function aplicar(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (b.consent !== true) return errorJson(422, "consentimiento_requerido");
  const lista = b.shared_fields;
  if (
    !Array.isArray(lista) ||
    lista.length > SHARED_FIELDS.length ||
    !lista.every((f): f is string => typeof f === "string" && (SHARED_FIELDS as readonly string[]).includes(f)) ||
    new Set(lista).size !== lista.length ||
    !MANDATORY_FIELDS.every((m) => lista.includes(m))
  ) {
    return errorJson(422, "datos_invalidos");
  }
  return reenviar(request, { method: "POST", path: `/offers/${id}/applications`, body: { consent: true, shared_fields: lista }, ok: { 201: "json" } });
}

export async function listarAplicaciones(request: Request): Promise<Response> {
  const salida = paginacion(new URL(request.url).searchParams, new URLSearchParams(), APPLICATION_STATUSES);
  if (!salida) return errorJson(422, "datos_invalidos");
  return reenviar(request, { method: "GET", path: conQuery("/me/applications", salida), ok: { 200: "json" } });
}

export async function leerAplicacion(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method: "GET", path: `/me/applications/${id}`, ok: { 200: "json" } });
}

export async function retirar(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method: "POST", path: `/me/applications/${id}/withdraw`, ok: { 204: "none" } });
}

export async function listarExternas(request: Request): Promise<Response> {
  const salida = paginacion(new URL(request.url).searchParams, new URLSearchParams(), EXTERNAL_STATUSES);
  if (!salida) return errorJson(422, "datos_invalidos");
  return reenviar(request, { method: "GET", path: conQuery("/me/external-applications", salida), ok: { 200: "json" } });
}

/** El cuerpo de un registro externo: los cinco campos del contrato con su tipo; el resto no viaja. */
async function cuerpoExterno(request: Request): Promise<Record<string, unknown> | Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  const notas = b.notes === undefined ? null : b.notes;
  if (
    typeof b.company_name !== "string" ||
    typeof b.position !== "string" ||
    typeof b.applied_on !== "string" ||
    !FECHA_RE.test(b.applied_on) ||
    typeof b.status !== "string" ||
    !(EXTERNAL_STATUSES as readonly string[]).includes(b.status) ||
    (notas !== null && typeof notas !== "string")
  ) {
    return errorJson(422, "datos_invalidos");
  }
  return { company_name: b.company_name, position: b.position, applied_on: b.applied_on, status: b.status, notes: notas };
}

export async function crearExterna(request: Request): Promise<Response> {
  const body = await cuerpoExterno(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "POST", path: "/me/external-applications", body, ok: { 201: "json" } });
}

export async function leerExterna(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method: "GET", path: `/me/external-applications/${id}`, ok: { 200: "json" } });
}

export async function reemplazarExterna(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const body = await cuerpoExterno(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "PUT", path: `/me/external-applications/${id}`, body, ok: { 204: "none" } });
}

export async function borrarExterna(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method: "DELETE", path: `/me/external-applications/${id}`, ok: { 204: "none" } });
}
