/** Llamadas del navegador a ofertas, aplicaciones y registros externos (/api/*). Nunca ven tokens. */
import { goTo } from "@/lib/navigate";
import type { ProfileData } from "@/lib/cv/types";
import {
  APPLICATION_STATUSES,
  OFFER_FILTERS,
  type Application,
  type ApplicationStatus,
  type ApplicationSummary,
  type ApplyBody,
  type CatalogRef,
  type External,
  type ExternalInput,
  type ExternalStatus,
  type ListParams,
  type OfferPublic,
  type OfferQuery,
  type OfferSummary,
  type Page,
} from "./types";

export interface Result<T> {
  status: number;
  data: T | null;
  error: string | null;
  /** Id de mi aplicación cuando el backend responde 409 ya_aplicaste. */
  applicationId: string | null;
  /** Estado vigente de la aplicación en un 409 estado_invalido. */
  currentStatus: ApplicationStatus | null;
  /** `Retry-After` de un 429, en segundos. */
  retryAfter: number | null;
}

const vacio = { data: null, error: null, applicationId: null, currentStatus: null, retryAfter: null };

/** Mismo comportamiento que el cliente de entrevistas: 401 -> /sign-in, fallo de red = status 0. */
async function call<T>(url: string, method = "GET", json?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    return { status: 0, ...vacio };
  }
  if (res.status === 401) goTo("/sign-in");
  let cuerpo: unknown = null;
  try {
    const texto = await res.text();
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = null;
  }
  if (res.status >= 200 && res.status < 300) return { status: res.status, ...vacio, data: (cuerpo as T) ?? null };
  const o = (cuerpo ?? {}) as { error?: unknown; application_id?: unknown; status?: unknown };
  const espera = res.headers.get("retry-after");
  return {
    status: res.status,
    data: null,
    error: typeof o.error === "string" ? o.error : null,
    applicationId: typeof o.application_id === "string" ? o.application_id : null,
    currentStatus: typeof o.status === "string" && (APPLICATION_STATUSES as readonly string[]).includes(o.status) ? (o.status as ApplicationStatus) : null,
    retryAfter: espera && /^\d{1,6}$/.test(espera) ? Number(espera) : null,
  };
}

/** La consulta de `GET /offers`: solo lo del contrato, los filtros con valor y en el orden del contrato. */
export function offerQuery(q: OfferQuery): string {
  const s = new URLSearchParams();
  if (q.limit !== undefined) s.set("limit", String(q.limit));
  if (q.cursor !== undefined) s.set("cursor", q.cursor);
  // `recent` es el orden por defecto: no hace falta mandarlo.
  if (q.sort && q.sort !== "recent") s.set("sort", q.sort);
  for (const f of OFFER_FILTERS) {
    const v = q.filters?.[f];
    if (v) s.set(f, v);
  }
  const texto = s.toString();
  return texto ? `?${texto}` : "";
}

function listQuery<S extends string>(p: ListParams<S>): string {
  const q = new URLSearchParams();
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  if (p.cursor !== undefined) q.set("cursor", p.cursor);
  if (p.status !== undefined) q.set("status", p.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type CatalogName = "professions" | "states" | "cities" | "contract-types" | "salary-ranges" | "working-shifts" | "employment-sectors" | "job-hierarchies";

export const offersApi = {
  list: (q: OfferQuery = {}) => call<Page<OfferSummary>>(`/api/offers${offerQuery(q)}`),
  get: (id: string) => call<OfferPublic>(`/api/offers/${id}`),
  apply: (id: string, body: ApplyBody) => call<Application>(`/api/offers/${id}/applications`, "POST", body),
  applications: (p: ListParams<ApplicationStatus> = {}) => call<Page<ApplicationSummary>>(`/api/applications${listQuery(p)}`),
  application: (id: string) => call<Application>(`/api/applications/${id}`),
  withdraw: (id: string) => call<null>(`/api/applications/${id}/withdraw`, "POST"),
  externals: (p: ListParams<ExternalStatus> = {}) => call<Page<External>>(`/api/applications/external${listQuery(p)}`),
  createExternal: (input: ExternalInput) => call<External>("/api/applications/external", "POST", input),
  updateExternal: (id: string, input: ExternalInput) => call<null>(`/api/applications/external/${id}`, "PUT", input),
  removeExternal: (id: string) => call<null>(`/api/applications/external/${id}`, "DELETE"),
  /** Catálogos de los filtros; `cities` se pide por departamento. */
  catalog: (name: CatalogName, stateId?: string) => call<CatalogRef[]>(`/api/catalogs/${name}${stateId ? `?state_id=${encodeURIComponent(stateId)}` : ""}`),
  /** El perfil, solo para avisar qué datos faltan al aplicar. No se guarda ni se muestra. */
  profile: () => call<ProfileData>("/api/profile"),
};
