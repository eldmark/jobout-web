/** Llamadas del navegador a nuestros endpoints (/api/*). Nunca ven tokens: van en cookies HttpOnly. */
import type { MessageKey } from "@/lib/messages";
import type { CatalogItem, CvSummary, ProfileData } from "./types";
import { goTo } from "@/lib/navigate";

export interface ApiResult<T> {
  status: number;
  data: T | null;
  error: string | null;
}

export function parseResult<T>(status: number, texto: string): ApiResult<T> {
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  if (status >= 200 && status < 300) return { status, data: (json as T) ?? null, error: null };
  const e = (json as { error?: unknown } | null)?.error;
  return { status, data: null, error: typeof e === "string" ? e : null };
}

/** fetch JSON propio. 401 -> /sign-in. Un fallo de red se informa como status 0. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch {
    return { status: 0, data: null, error: null };
  }
  const out = parseResult<T>(res.status, await res.text().catch(() => ""));
  if (res.status === 401) goTo("/sign-in");
  return out;
}

/** Subida con progreso (XMLHttpRequest nativo). */
export function uploadCv(file: File, onProgress: (porcentaje: number) => void): Promise<ApiResult<unknown>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cvs");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const r = parseResult<unknown>(xhr.status, xhr.responseText);
      if (xhr.status === 401) goTo("/sign-in");
      resolve(r);
    };
    xhr.onerror = () => resolve({ status: 0, data: null, error: null });
    xhr.onabort = () => resolve({ status: 0, data: null, error: null });
    const form = new FormData();
    form.set("file", file, file.name);
    xhr.send(form);
  });
}

/** Códigos del contrato -> mensaje en español (sin texto técnico ni nombres de campo). */
export function errorKey(status: number, error: string | null): MessageKey {
  switch (error) {
    case "limite_de_cvs":
      return "cv.error.limit";
    case "archivo_demasiado_grande":
      return "cv.error.tooBig";
    case "tipo_no_permitido":
      return "cv.error.badType";
    case "datos_invalidos":
      return "cv.error.invalid";
    case "no_encontrado":
      return "cv.error.notFound";
    default:
      return status === 422 ? "cv.error.invalid" : "cv.error.generic";
  }
}

export async function loadCatalogs(nombres: string[]): Promise<Record<string, CatalogItem[] | null>> {
  const rs = await Promise.all(nombres.map((n) => apiFetch<CatalogItem[]>(`/api/catalogs/${n}`)));
  return Object.fromEntries(nombres.map((n, i) => [n, rs[i].data]));
}

/** Todo lo que necesita la pantalla de perfil; null si lo imprescindible falló. */
export async function loadProfileScreen() {
  const [perfil, cvs, cat] = await Promise.all([
    apiFetch<ProfileData>("/api/profile"),
    apiFetch<CvSummary[]>("/api/cvs"),
    loadCatalogs(["skills", "languages", "academic-levels", "professions", "job-hierarchies"]),
  ]);
  if (!perfil.data || !cvs.data || !cat.skills || !cat.languages) return null;
  return { perfil: perfil.data, cvs: cvs.data, cat };
}

export async function fetchCvs(): Promise<CvSummary[] | null> {
  return (await apiFetch<CvSummary[]>("/api/cvs")).data;
}
