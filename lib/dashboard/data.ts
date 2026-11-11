/**
 * Lecturas del servidor para los paneles. Cada una pide solo lo que ya existe en el backend, con el
 * token de la sesión, y ante cualquier duda (error, forma rara, caída) devuelve null: un dato que no
 * se pudo saber no se pinta ni se inventa.
 */
import { backendUrl } from "@/lib/auth/server";
import type { ProgressPoint } from "@/lib/interviews/types";
import type { CatalogRef } from "@/lib/offers/types";

async function getJson(access: string, path: string): Promise<unknown> {
  try {
    const res = await fetch(`${backendUrl()}/api/v1${path}`, { headers: { authorization: `Bearer ${access}` }, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `{items: [...]}` → la lista; cualquier otra forma → null. */
function items(v: unknown): unknown[] | null {
  return isRecord(v) && Array.isArray(v.items) ? v.items : null;
}

function catalog(v: unknown): CatalogRef[] {
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is CatalogRef => isRecord(c) && typeof c.id === "string" && typeof c.name === "string");
}

function points(v: unknown): ProgressPoint[] | null {
  const lista = items(v);
  if (!lista) return null;
  return lista.filter((p): p is ProgressPoint => isRecord(p) && typeof p.completed_at === "string" && typeof p.score === "number");
}

export interface CandidateData {
  /** null = no se pudo leer (distinto de «no hay prácticas», que es una lista vacía). */
  points: ProgressPoint[] | null;
  applications: number | null;
  hasCv: boolean | null;
  hasSkills: boolean | null;
  professions: CatalogRef[];
  contractTypes: CatalogRef[];
}

export async function loadCandidate(access: string): Promise<CandidateData> {
  const [progreso, aplicaciones, cvs, perfil, profesiones, contratos] = await Promise.all([
    getJson(access, "/progress"),
    getJson(access, "/me/applications?limit=50"),
    getJson(access, "/cvs"),
    getJson(access, "/profile"),
    getJson(access, "/catalogs/professions"),
    getJson(access, "/catalogs/contract-types"),
  ]);
  const apps = items(aplicaciones);
  return {
    points: points(progreso),
    applications: apps ? apps.length : null,
    hasCv: Array.isArray(cvs) ? cvs.length > 0 : null,
    hasSkills: isRecord(perfil) && Array.isArray(perfil.skills) ? perfil.skills.length > 0 : null,
    professions: catalog(profesiones),
    contractTypes: catalog(contratos),
  };
}

/** «Completa tu perfil» solo si SABEMOS que no hay CV ni skills (misma regla de siempre). */
export const needsProfile = (d: CandidateData): boolean => d.hasCv === false && d.hasSkills === false;

export interface CompanyData {
  offersTotal: number;
  offersPublished: number;
  /** Aplicaciones que suman las ofertas publicadas. */
  received: number;
  /** true si hay más ofertas que las leídas: las cifras son «al menos». */
  partial: boolean;
  verified: boolean | null;
  membership: "active" | "expired" | null;
}

export async function loadCompany(access: string): Promise<CompanyData | null> {
  const [empresa, ofertas] = await Promise.all([getJson(access, "/company"), getJson(access, "/company/offers?limit=50")]);
  const lista = items(ofertas);
  if (!lista) return null;
  const filas = lista.filter(isRecord);
  const publicadas = filas.filter((o) => o.status === "published");
  const membership = isRecord(empresa) && isRecord(empresa.membership) ? empresa.membership.status : null;
  return {
    offersTotal: filas.length,
    offersPublished: publicadas.length,
    received: publicadas.reduce((s, o) => s + (typeof o.applications_count === "number" ? o.applications_count : 0), 0),
    partial: isRecord(ofertas) && typeof ofertas.next_cursor === "string" && ofertas.next_cursor !== "",
    verified: isRecord(empresa) && typeof empresa.verified === "boolean" ? empresa.verified : null,
    membership: membership === "active" || membership === "expired" ? membership : null,
  };
}

export interface AdminData {
  pending: number;
  partial: boolean;
}

export async function loadAdmin(access: string): Promise<AdminData | null> {
  const r = await getJson(access, "/admin/companies?verified=false&limit=50");
  const lista = items(r);
  if (!lista) return null;
  return { pending: lista.length, partial: isRecord(r) && typeof r.next_cursor === "string" && r.next_cursor !== "" };
}
