/**
 * Capa servidor de la sesión. Decisión: route handlers de Next (no server actions), porque
 * los formularios son componentes de cliente con estados propios (errores, aria-live) y
 * así cada endpoint se prueba con un `Request` y `fetch` simulado, sin el runtime de Next.
 * Los tokens solo existen aquí y en cookies HttpOnly: el JS del navegador nunca los ve.
 * Solo servidor: no importar desde componentes de cliente.
 */
import { createApiClient } from "@/lib/api/client";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  clearSessionCookie,
  serializeSessionCookie,
} from "./cookies";

export const API_PREFIX = "/api/v1";
/** Tope de la cookie de refresh; la vida real la decide el backend (supuesto: ≤ 30 días). */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function backendUrl(): string {
  return process.env.API_URL_INTERNA ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}

/** Códigos de error que el backend puede devolver y que se reenvían tal cual al navegador. */
const CODIGOS_CONOCIDOS = new Set([
  "registro_no_disponible",
  "datos_invalidos",
  "credenciales_invalidas",
  "cuenta_no_disponible",
  "demasiados_intentos",
  "contrasena_incorrecta",
]);

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function setTokenCookies(headers: Headers, tokens: Tokens): void {
  headers.append(
    "Set-Cookie",
    serializeSessionCookie(SESSION_COOKIE, tokens.access_token, {
      maxAgeSeconds: tokens.expires_in > 0 ? tokens.expires_in : 900,
    }),
  );
  headers.append(
    "Set-Cookie",
    serializeSessionCookie(REFRESH_COOKIE, tokens.refresh_token, {
      maxAgeSeconds: REFRESH_COOKIE_MAX_AGE,
    }),
  );
}

export function clearSessionCookies(headers: Headers): void {
  headers.append("Set-Cookie", clearSessionCookie(SESSION_COOKIE));
  headers.append("Set-Cookie", clearSessionCookie(REFRESH_COOKIE));
}

export function errorJson(status: number, error: string, headers?: Headers): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify({ error }), { status, headers: h });
}

export function okJson(headers?: Headers): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const isEmail = (v: unknown): v is string =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 254;

export const isPassword = (v: unknown): v is string =>
  typeof v === "string" && v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX;

function isTokens(v: unknown): v is Tokens {
  const o = v as Partial<Tokens> | null;
  return Boolean(o && typeof o.access_token === "string" && typeof o.refresh_token === "string");
}

async function postBackend(path: string, body: unknown): Promise<Response> {
  return fetch(`${backendUrl()}${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

/**
 * register/login: reenvía al backend. Éxito -> cookies y cuerpo `{ok:true}` (sin tokens).
 * Error -> solo se reenvían códigos conocidos; cualquier otra cosa es un 502 genérico.
 */
export async function authenticate(path: "/auth/register" | "/auth/login", body: unknown, okStatus: number): Promise<Response> {
  let res: Response;
  try {
    res = await postBackend(path, body);
  } catch {
    return errorJson(502, "servicio_no_disponible");
  }
  if (res.status === okStatus) {
    const tokens: unknown = await res.json().catch(() => null);
    if (!isTokens(tokens)) return errorJson(502, "servicio_no_disponible");
    const h = new Headers();
    setTokenCookies(h, tokens);
    return okJson(h);
  }
  if ([401, 403, 409, 422, 429].includes(res.status)) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof data?.error === "string" && CODIGOS_CONOCIDOS.has(data.error)) {
      return errorJson(res.status, data.error);
    }
  }
  return errorJson(502, "servicio_no_disponible");
}

/** Intercambia el refresh token por tokens nuevos; null si no se pudo. */
export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  try {
    const res = await postBackend("/auth/refresh", { refresh_token: refreshToken });
    if (!res.ok) return null;
    const tokens: unknown = await res.json().catch(() => null);
    return isTokens(tokens) ? tokens : null;
  } catch {
    return null;
  }
}

/**
 * Llamada autenticada al backend con el cliente existente: Bearer y, ante un 401, UN refresh
 * con el refresh token de las cookies. Si se renovó, `rotated` trae los tokens nuevos para
 * que el handler los escriba en cookies.
 */
export function authedBackend(request: Request) {
  const access = readCookie(request, SESSION_COOKIE);
  const refresh = readCookie(request, REFRESH_COOKIE);
  let rotated: Tokens | null = null;
  let expired = false;
  const client = createApiClient({
    baseUrl: `${backendUrl()}`,
    getAccessToken: () => access,
    onSessionExpired: () => {
      expired = true;
    },
    refreshToken: async () => {
      if (!refresh) return undefined;
      rotated = await refreshTokens(refresh);
      return rotated?.access_token;
    },
  });
  return {
    hasSession: Boolean(access || refresh),
    request: client.request,
    get rotated() {
      return rotated;
    },
    get expired() {
      return expired;
    },
  };
}
