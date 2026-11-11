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
const EMPRESA: NavLink[] = [
  { href: "/company", key: "dashboard.nav.company" },
  { href: "/company/offers", key: "dashboard.nav.companyOffers" },
];
/** HU-50: un candidato sin empresa puede registrarla (o aceptar una invitación) en /company; no es el panel. */
const REGISTRAR: NavLink = { href: "/company", key: "dashboard.nav.registerCompany" };
const ADMIN: NavLink = { href: "/admin/companies", key: "dashboard.nav.adminCompanies" };

/** Los enlaces del panel principal, por grupos: candidato, empresa y administración de plataforma. */
export function navFor(roles: readonly string[]): NavLink[] {
  const deEmpresa = roles.includes("company_admin") || roles.includes("recruiter");
  const enlaces: NavLink[] = [];
  if (roles.includes("applicant")) enlaces.push(...CANDIDATO);
  if (deEmpresa) enlaces.push(...EMPRESA);
  else if (roles.includes("applicant")) enlaces.push(REGISTRAR);
  if (roles.includes("admin")) enlaces.push(ADMIN);
  return enlaces;
}
