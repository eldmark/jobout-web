/**
 * Datos de ejemplo del contrato de ofertas y aplicaciones para candidatos (Fase 5a): `api.md`,
 * «Ofertas para candidatos», «Aplicar, ver y retirar» y «Registro de aplicaciones externas».
 * Las formas salen de `jobout-core-api` (`src/routes/offers_public.rs`, `applications.rs`,
 * `external_applications.rs`).
 */
import { jsonRes } from "./backend";

export const OID = "66666666-6666-4666-8666-666666666666";
export const OID2 = "66666666-6666-4666-8666-666666666667";
export const AID = "77777777-7777-4777-8777-777777777777";
export const EID = "88888888-8888-4888-8888-888888888888";
export const ST_GT = "99999999-9999-4999-8999-000000000001";
export const ST_SAC = "99999999-9999-4999-8999-000000000002";
export const CI_MIXCO = "99999999-9999-4999-8999-000000000011";
export const PROF = "99999999-9999-4999-8999-000000000021";

const cat = (id: string, code: string, name: string) => ({ id, code, name });

export const GUATEMALA = cat(ST_GT, "guatemala", "Guatemala");
export const SACATEPEQUEZ = cat(ST_SAC, "sacatepequez", "Sacatepéquez");
export const MIXCO = cat(CI_MIXCO, "mixco", "Mixco");
export const ANTIGUA = cat("99999999-9999-4999-8999-000000000012", "antigua", "Antigua Guatemala");

export const EMPRESA = { id: "co-1", name: "Café Nuevo S.A.", website: "https://cafenuevo.example" };

export const OFERTA = (over: Record<string, unknown> = {}) => ({
  id: OID,
  title: "Desarrollador backend",
  confidential: false,
  company: EMPRESA,
  profession: cat(PROF, "software_engineer", "Ingeniería de software"),
  employment_sector: cat("e-1", "tech", "Tecnología"),
  state: GUATEMALA,
  city: MIXCO,
  contract_type: cat("ct-1", "indefinite", "Indefinido"),
  salary_range: cat("sr-1", "q8000_12000", "Q8,000 a Q12,000"),
  working_shift: cat("ws-1", "day", "Diurna"),
  vacancies: 2,
  publication_date: "2026-11-12",
  my_application: null,
  ...over,
});

/** Una confidencial: `company` es null y `confidential` true. */
export const CONFIDENCIAL = (over: Record<string, unknown> = {}) =>
  OFERTA({ id: OID2, title: "Analista de datos", confidential: true, company: null, ...over });

export const DETALLE = (over: Record<string, unknown> = {}) => ({
  ...OFERTA(),
  description: "Buscamos a alguien para el equipo de pagos.\nTrabajo híbrido.",
  schedule: "Lunes a viernes, 8:00 a 17:00",
  hiring_date: "2027-02-01",
  required_experience: 2,
  required_availability_to_travel: false,
  required_driver_license: true,
  main_language: cat("l-es", "es", "Español"),
  job_hierarchy: cat("j-1", "junior", "Junior"),
  minimum_academic_level: cat("a-1", "grado", "Licenciatura"),
  skills: [
    { skill: cat("s-rust", "rust", "Rust"), is_required: true, min_level: "intermediate" },
    { skill: cat("s-sql", "sql", "SQL"), is_required: false, min_level: null },
  ],
  languages: [{ language: cat("l-en", "en", "Inglés"), min_proficiency: "intermediate" }],
  driver_licenses: [cat("dl-b", "b", "Tipo B")],
  ...over,
});

export const paginaOfertas = <T>(lista: T[], next_cursor: string | null = null) => ({ items: lista, next_cursor });

/** El backend manda las fechas con microsegundos (`to_char(... 'US')`). */
export const APLICADA = "2026-11-13T15:00:00.123456Z";

export const APLICACION = (over: Record<string, unknown> = {}, oferta: Record<string, unknown> = {}) => ({
  id: AID,
  status: "applied",
  applied_at: APLICADA,
  status_changed_at: APLICADA,
  consented_at: APLICADA,
  offer: { id: OID, title: "Desarrollador backend", status: "published", confidential: false, company: EMPRESA, state: GUATEMALA, city: MIXCO, ...oferta },
  ...over,
});

export const APLICACION_DETALLE = (over: Record<string, unknown> = {}, oferta: Record<string, unknown> = {}) => ({
  ...APLICACION({}, oferta),
  shared_fields: ["display_name", "skills", "experience", "email"],
  history: [{ status: "applied", at: APLICADA }],
  ...over,
});

export const EXTERNA = (over: Record<string, unknown> = {}) => ({
  id: EID,
  company_name: "Banco X",
  position: "Analista",
  applied_on: "2026-11-05",
  status: "interviewing",
  notes: "Hablé con RRHH, esperan al 20.",
  created_at: "2026-11-06T10:00:00.000000Z",
  ...over,
});

/** Perfil completo y vacío, con la forma de GET /profile. */
export const PERFIL = (over: Record<string, unknown> = {}) => ({
  description: "Backend con Rust.",
  phone: "+502 5555 0000",
  academic_level_id: "a-1",
  profession_id: PROF,
  job_hierarchy_id: null,
  skills: [{ skill_id: "s-rust", level: "advanced", years_of_experience: 3 }],
  languages: [{ language_id: "l-en", proficiency: "advanced" }],
  experiences: [{ company: "Acme", title: "Dev", start_date: "2021-01-01", end_date: null, description: "APIs de pagos." }],
  ...over,
});
export const PERFIL_VACIO = { description: null, phone: null, academic_level_id: null, profession_id: null, job_hierarchy_id: null, skills: [], languages: [], experiences: [] };

/** Catálogos de los filtros (`GET /api/catalogs/{nombre}`); `cities` depende de `state_id`. */
export const CATALOGOS: Record<string, unknown[]> = {
  professions: [cat(PROF, "software_engineer", "Ingeniería de software"), cat("p-2", "data", "Datos")],
  states: [GUATEMALA, SACATEPEQUEZ],
  "contract-types": [cat("ct-1", "indefinite", "Indefinido"), cat("ct-2", "temporary", "Temporal")],
  "salary-ranges": [cat("sr-1", "q8000_12000", "Q8,000 a Q12,000")],
  "working-shifts": [cat("ws-1", "day", "Diurna")],
  "employment-sectors": [cat("e-1", "tech", "Tecnología")],
  "job-hierarchies": [cat("j-1", "junior", "Junior")],
};
export const MUNICIPIOS: Record<string, unknown[]> = { [ST_GT]: [MIXCO], [ST_SAC]: [ANTIGUA] };

export function catalogoOfertas(url: string): Response | null {
  const u = new URL(url, "http://x");
  const m = u.pathname.match(/^\/api\/catalogs\/(.+)$/);
  if (!m) return null;
  if (m[1] === "cities") return jsonRes(200, MUNICIPIOS[u.searchParams.get("state_id") ?? ""] ?? []);
  return jsonRes(200, CATALOGOS[m[1]] ?? []);
}

/** Texto hostil (SX7): si algo de esto se interpretara como HTML, aparecería un elemento. */
export const HOSTIL = `<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script><b>negrita</b>`;
