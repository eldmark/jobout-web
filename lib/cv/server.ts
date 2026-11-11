/**
 * Reenvío de CV, perfil y catálogos al backend. Solo servidor: el navegador nunca ve el
 * Bearer ni la URL del backend. Solo se reenvían los códigos de error del contrato; todo lo
 * demás es un 502 genérico sin detalles.
 */
import { SessionExpiredError } from "@/lib/api/client";
import { authedBackend, clearSessionCookies, errorJson, readJson, setTokenCookies, API_PREFIX } from "@/lib/auth/server";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Los del perfil (Fase 2) y los que usan los filtros de ofertas (Fase 5a). `zones` y `membership-types` no se sirven. */
export const CATALOGOS = [
  "skills",
  "languages",
  "academic-levels",
  "professions",
  "job-hierarchies",
  "states",
  "cities",
  "contract-types",
  "salary-ranges",
  "working-shifts",
  "employment-sectors",
  "countries",
  "driver-licenses",
] as const;

const CODIGOS_POR_ESTADO: Record<number, string> = {
  404: "no_encontrado",
  409: "limite_de_cvs",
  413: "archivo_demasiado_grande",
  415: "tipo_no_permitido",
  422: "datos_invalidos",
};

export const noEncontrado = () => errorJson(404, "no_encontrado");

interface Opciones {
  method: string;
  path: string;
  body?: BodyInit;
  headers?: HeadersInit;
  /** "json": reenvía el JSON validado; "bytes": reenvía el archivo; "none": solo estado. */
  ok: Record<number, "json" | "bytes" | "none">;
  /**
   * Errores permitidos por estado (por defecto, los de CV). Una lista = códigos del backend que se
   * reenvían tal cual; un texto = se informa siempre ese código, sin mirar el cuerpo.
   */
  errors?: Record<number, readonly string[] | string>;
  /** Campos de texto del cuerpo de error que se conservan, cada uno con el formato que debe cumplir
   * (p. ej. `session_id` UUID, `renews_at` fecha ISO). Lo que no cumple o no está listado se descarta. */
  echo?: Record<string, RegExp>;
  /** Campos de lista del cuerpo de error que se conservan: solo los nombres de la lista (p. ej. `fields`). */
  echoList?: Record<string, readonly string[]>;
}

export async function forward(request: Request, o: Opciones): Promise<Response> {
  const api = authedBackend(request);
  if (!api.hasSession) return errorJson(401, "sesion_expirada");

  let res: Response;
  try {
    res = await api.request(`${API_PREFIX}${o.path}`, { method: o.method, body: o.body, headers: o.headers, cache: "no-store" });
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      const h = new Headers();
      clearSessionCookies(h);
      return errorJson(401, "sesion_expirada", h);
    }
    return errorJson(502, "servicio_no_disponible");
  }

  const h = new Headers({ "cache-control": "no-store" });
  if (api.rotated) setTokenCookies(h, api.rotated);

  const modo = o.ok[res.status];
  if (modo === "none") return new Response(null, { status: res.status, headers: h });
  if (modo === "json") {
    const texto = await res.text().catch(() => "");
    try {
      JSON.parse(texto);
    } catch {
      return errorJson(502, "servicio_no_disponible", h);
    }
    h.set("content-type", "application/json");
    return new Response(texto, { status: res.status, headers: h });
  }
  if (modo === "bytes") {
    h.set("content-type", res.headers.get("content-type") ?? "application/octet-stream");
    const disp = res.headers.get("content-disposition");
    h.set("content-disposition", disp && /^attachment/i.test(disp) ? disp : "attachment");
    h.set("x-content-type-options", "nosniff");
    return new Response(res.body, { status: 200, headers: h });
  }

  // Retry-After solo como segundos enteros: es lo único que el contrato promete y lo único que se reenvía.
  const espera = res.headers.get("retry-after");
  if (res.status === 429 && espera && /^\d{1,6}$/.test(espera)) h.set("retry-after", espera);

  const permitido = o.errors?.[res.status] ?? CODIGOS_POR_ESTADO[res.status];
  if (typeof permitido === "string" && o.errors) return errorJson(res.status, permitido, h);
  if (permitido) {
    const lista = typeof permitido === "string" ? [permitido] : permitido;
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const codigo = data?.error;
    if (typeof codigo === "string" && lista.includes(codigo)) {
      const extra: Record<string, string | string[]> = {};
      for (const [campo, formato] of Object.entries(o.echo ?? {})) {
        const v = data?.[campo];
        if (typeof v === "string" && formato.test(v)) extra[campo] = v;
      }
      for (const [campo, permitidos] of Object.entries(o.echoList ?? {})) {
        const v = data?.[campo];
        if (Array.isArray(v)) extra[campo] = v.filter((x): x is string => typeof x === "string" && permitidos.includes(x));
      }
      if (Object.keys(extra).length === 0) return errorJson(res.status, codigo, h);
      h.set("content-type", "application/json");
      return new Response(JSON.stringify({ error: codigo, ...extra }), { status: res.status, headers: h });
    }
  }
  return errorJson(502, "servicio_no_disponible", h);
}

/** Cuerpo JSON de objeto -> 422 sin tocar el backend si no lo es. */
export async function jsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  const b = await readJson(request);
  return b ?? errorJson(422, "datos_invalidos");
}

export async function idParam(params: Promise<{ id: string }>): Promise<string | null> {
  const { id } = await params;
  return UUID_RE.test(id) ? id : null;
}
