/**
 * Menú según los roles de `GET /me` (FC6). Es solo comodidad: el backend autoriza en cada ruta.
 * Una misma cuenta puede ser candidata y reclutadora a la vez (decisión 10), así que cada grupo se
 * decide por su rol, sin suponer que la persona tiene uno solo.
 */
import type { MessageKey } from "@/lib/messages";

export interface NavLink {
  href: string;
  key: MessageKey;
}

/** Roles de `/me`: solo cadenas; cualquier otra forma es una lista vacía (nunca se inventa un rol). */
export function parseRoles(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((r): r is string => typeof r === "string") : [];
}

const CANDIDATO: NavLink[] = [
  { href: "/offers", key: "dashboard.nav.offers" },
  { href: "/applications", key: "dashboard.nav.applications" },
];

/** Los enlaces del panel. Los del reclutador (`company_admin`, `recruiter`) llegan con sus páginas (paso 12). */
export function navFor(roles: readonly string[]): NavLink[] {
  return roles.includes("applicant") ? CANDIDATO : [];
}
