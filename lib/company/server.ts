/**
 * Reenvío del lado empresa y de administración al backend (Fase 5a). Solo servidor. Mismo patrón que
 * ofertas: el navegador nunca ve el Bearer; lo que no cumple el contrato se rechaza aquí con 422 sin
 * tocar el backend; de los errores solo pasan los códigos del contrato y los ecos validados (`status`
 * de la máquina y `fields` con nombres conocidos). Nunca el texto del backend.
 */
import { forward, idParam, jsonBody, noEncontrado, UUID_RE } from "@/lib/cv/server";
import { errorJson } from "@/lib/auth/server";
import { countChars } from "@/lib/interviews/types";
import { conQuery, paginacion } from "@/lib/offers/server";
import { APPLICATION_STATUSES } from "@/lib/offers/types";
import { COMPANY_ROLES, NOTE_MAX, OFFER_INPUT_KEYS, OFFER_STATUSES, PANEL_SORTS, PUBLISH_FIELDS, RECRUITER_TARGETS } from "./types";

/** Errores permitidos por estado (`api.md`, «Códigos de error del grupo»). */
export const ERRORES_EMPRESA: Record<number, readonly string[] | string> = {
  403: ["cuenta_no_disponible", "sin_permiso", "empresa_no_verificada", "membresia_vencida"],
  404: ["no_encontrado", "invitacion_invalida"],
  409: ["estado_invalido", "ya_tiene_empresa", "empresa_duplicada", "nit_inmutable", "ultimo_administrador", "oferta_con_aplicaciones", "confidencial_inmutable"],
  413: "cuerpo_demasiado_grande",
  422: ["datos_invalidos", "campo_no_permitido", "parametro_no_permitido", "oferta_incompleta"],
  429: "demasiados_intentos",
};

type Modo = "json" | "none";

function reenviar(request: Request, o: { method: string; path: string; body?: unknown; ok: Record<number, Modo> }) {
  return forward(request, {
    method: o.method,
    path: o.path,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    headers: o.body === undefined ? undefined : { "content-type": "application/json" },
    ok: o.ok,
    errors: ERRORES_EMPRESA,
    echo: { status: new RegExp(`^(${APPLICATION_STATUSES.join("|")})$`) },
    echoList: { fields: PUBLISH_FIELDS },
  });
}

const invalido = () => errorJson(422, "datos_invalidos");
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const esTextoONulo = (v: unknown) => v === undefined || v === null || typeof v === "string";
const esIdONulo = (v: unknown) => v === undefined || v === null || (typeof v === "string" && UUID_RE.test(v));

/** Acción por id (sin cuerpo): valida el id antes de tocar el backend. */
async function porId(request: Request, params: Promise<{ id: string }>, method: string, ruta: (id: string) => string, ok: Record<number, Modo>, body?: unknown) {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return reenviar(request, { method, path: ruta(id), ok, body });
}

/** Listado con limit, cursor y, si se dan, otros parámetros validados. Lo demás no viaja. */
async function listar(request: Request, path: string, extra: (entrada: URLSearchParams, salida: URLSearchParams) => boolean = () => true) {
  const entrada = new URL(request.url).searchParams;
  const salida = paginacion(entrada, new URLSearchParams());
  if (!salida || !extra(entrada, salida)) return invalido();
  return reenviar(request, { method: "GET", path: conQuery(path, salida), ok: { 200: "json" } });
}

/** Copia un parámetro si está y es uno de los valores permitidos; false si está y no lo es. */
function opcion(entrada: URLSearchParams, salida: URLSearchParams, nombre: string, valores: readonly string[]): boolean {
  const v = entrada.get(nombre);
  if (v === null) return true;
  if (!valores.includes(v)) return false;
  salida.set(nombre, v);
  return true;
}

// ------------------------------------------------------------------ empresa

/** `CompanyInput`: solo sus siete campos; lo calculado por el servidor no se puede mandar. */
async function cuerpoEmpresa(request: Request): Promise<Record<string, unknown> | Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (
    typeof b.name !== "string" ||
    typeof b.tax_id !== "string" ||
    typeof b.country_id !== "string" ||
    !UUID_RE.test(b.country_id) ||
    typeof b.employment_sector_id !== "string" ||
    !UUID_RE.test(b.employment_sector_id) ||
    ![b.website, b.phone, b.description].every(esTextoONulo)
  ) {
    return invalido();
  }
  return {
    name: b.name,
    tax_id: b.tax_id,
    website: b.website ?? null,
    phone: b.phone ?? null,
    description: b.description ?? null,
    country_id: b.country_id,
    employment_sector_id: b.employment_sector_id,
  };
}

export const leerEmpresa = (request: Request) => reenviar(request, { method: "GET", path: "/company", ok: { 200: "json" } });

export async function crearEmpresa(request: Request): Promise<Response> {
  const body = await cuerpoEmpresa(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "POST", path: "/companies", body, ok: { 201: "json" } });
}

export async function editarEmpresa(request: Request): Promise<Response> {
  const body = await cuerpoEmpresa(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "PUT", path: "/company", body, ok: { 204: "none" } });
}

export const listarReclutadores = (request: Request) => listar(request, "/company/recruiters");
export const quitarReclutador = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "DELETE", (id) => `/company/recruiters/${id}`, { 204: "none" });
export const listarInvitaciones = (request: Request) => listar(request, "/company/invitations");
export const revocarInvitacion = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "DELETE", (id) => `/company/invitations/${id}`, { 204: "none" });

/** `{email, role}`: el token del 201 viaja tal cual al navegador, que lo muestra una sola vez. */
export async function invitar(request: Request): Promise<Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.email !== "string" || b.email.trim() === "" || b.email.length > 254 || typeof b.role !== "string" || !(COMPANY_ROLES as readonly string[]).includes(b.role)) return invalido();
  return reenviar(request, { method: "POST", path: "/company/invitations", body: { email: b.email.trim(), role: b.role }, ok: { 201: "json" } });
}

export async function aceptarInvitacion(request: Request): Promise<Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  if (token === "" || token.length > 200) return invalido();
  return reenviar(request, { method: "POST", path: "/invitations/accept", body: { token }, ok: { 200: "json" } });
}

// ------------------------------------------------------------------ ofertas del reclutador

/**
 * `OfferInput`: solo sus campos, con su tipo. Cualquier otro (edad, género, estado civil, `featured`,
 * `status`…) no viaja nunca (OF4). Los topes los valida el backend.
 */
async function cuerpoOferta(request: Request): Promise<Record<string, unknown> | Response> {
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.title !== "string") return invalido();
  const ids = ["main_language_id", "profession_id", "employment_sector_id", "job_hierarchy_id", "minimum_academic_level_id", "state_id", "city_id", "salary_range_id", "working_shift_id", "contract_type_id"];
  const numeros = ["required_experience", "vacancies"];
  const flags = ["is_confidential", "is_experience_required", "required_availability_to_travel"];
  const listas = ["skills", "languages", "driver_license_ids"];
  const ok =
    ids.every((k) => esIdONulo(b[k])) &&
    numeros.every((k) => b[k] === undefined || b[k] === null || Number.isInteger(b[k])) &&
    flags.every((k) => b[k] === undefined || typeof b[k] === "boolean") &&
    listas.every((k) => b[k] === undefined || Array.isArray(b[k])) &&
    [b.description, b.schedule].every(esTextoONulo) &&
    (b.hiring_date === undefined || b.hiring_date === null || (typeof b.hiring_date === "string" && FECHA_RE.test(b.hiring_date)));
  if (!ok) return invalido();
  return Object.fromEntries(OFFER_INPUT_KEYS.filter((k) => k in b).map((k) => [k, b[k]]));
}

export const listarOfertas = (request: Request) => listar(request, "/company/offers", (e, s) => opcion(e, s, "status", OFFER_STATUSES));
export const leerOferta = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "GET", (id) => `/company/offers/${id}`, { 200: "json" });
export const borrarOferta = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "DELETE", (id) => `/company/offers/${id}`, { 204: "none" });
export const publicarOferta = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "POST", (id) => `/company/offers/${id}/publish`, { 200: "json" });
export const pausarOferta = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "POST", (id) => `/company/offers/${id}/pause`, { 204: "none" });
export const cerrarOferta = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "POST", (id) => `/company/offers/${id}/close`, { 204: "none" });

export async function crearOferta(request: Request): Promise<Response> {
  const body = await cuerpoOferta(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "POST", path: "/company/offers", body, ok: { 201: "json" } });
}

export async function reemplazarOferta(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const body = await cuerpoOferta(request);
  if (body instanceof Response) return body;
  return reenviar(request, { method: "PUT", path: `/company/offers/${id}`, body, ok: { 204: "none" } });
}

// ------------------------------------------------------------------ panel

/** PA9: filtros y orden cerrados. Cualquier otro parámetro (nombre, edad, género, foto…) no viaja. */
export async function listarPanel(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  return listar(request, `/company/offers/${id}/applications`, (e, s) => opcion(e, s, "status", APPLICATION_STATUSES) && opcion(e, s, "favorite", ["true", "false"]) && opcion(e, s, "sort", PANEL_SORTS));
}

export const leerAplicacionPanel = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "GET", (id) => `/company/applications/${id}`, { 200: "json" });

/** `{to, note?}`: nunca a `applied` ni a `withdrawn`; la nota recortada, hasta 500 caracteres, y vacía no viaja. */
export async function moverAplicacion(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.to !== "string" || !(RECRUITER_TARGETS as readonly string[]).includes(b.to) || !esTextoONulo(b.note)) return invalido();
  const nota = typeof b.note === "string" ? b.note.trim() : "";
  if (countChars(nota) > NOTE_MAX) return invalido();
  return reenviar(request, { method: "POST", path: `/company/applications/${id}/status`, body: nota ? { to: b.to, note: nota } : { to: b.to }, ok: { 200: "json" } });
}

export const marcarFavorito = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "PUT", (id) => `/company/applications/${id}/favorite`, { 204: "none" });
export const quitarFavorito = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "DELETE", (id) => `/company/applications/${id}/favorite`, { 204: "none" });

// ------------------------------------------------------------------ administración

export const listarEmpresasAdmin = (request: Request) => listar(request, "/admin/companies", (e, s) => opcion(e, s, "verified", ["true", "false"]));
export const verificar = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "POST", (id) => `/admin/companies/${id}/verify`, { 204: "none" });
export const quitarVerificacion = (request: Request, params: Promise<{ id: string }>) => porId(request, params, "POST", (id) => `/admin/companies/${id}/unverify`, { 204: "none" });

export async function fijarMembresia(request: Request, params: Promise<{ id: string }>): Promise<Response> {
  const id = await idParam(params);
  if (!id) return noEncontrado();
  const b = await jsonBody(request);
  if (b instanceof Response) return b;
  if (typeof b.membership_type !== "string" || typeof b.start_date !== "string" || !FECHA_RE.test(b.start_date) || typeof b.expiration_date !== "string" || !FECHA_RE.test(b.expiration_date)) return invalido();
  return reenviar(request, {
    method: "PUT",
    path: `/admin/companies/${id}/membership`,
    body: { membership_type: b.membership_type, start_date: b.start_date, expiration_date: b.expiration_date },
    ok: { 204: "none" },
  });
}
