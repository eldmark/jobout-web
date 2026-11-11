/**
 * Datos de ejemplo del lado empresa (Fase 5a): `api.md`, «Empresas, reclutadores e invitaciones»,
 * «Verificación de la empresa y membresía», «Ofertas del reclutador» y «Panel del reclutador» (con las
 * precisiones del paso 7). Formas tomadas de core-api (`companies.rs`, `offers.rs`, `admin_companies.rs`
 * y `panel.rs` de `jb-67-recruiter-panel`).
 */
export const CID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
export const OFF = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
export const PAP = "cccccccc-cccc-4ccc-8ccc-000000000001";
export const PAP2 = "cccccccc-cccc-4ccc-8ccc-000000000002";
export const REC = "dddddddd-dddd-4ddd-8ddd-000000000001";
export const INV = "eeeeeeee-eeee-4eee-8eee-000000000001";
export const PAIS = "ffffffff-ffff-4fff-8fff-000000000001";
export const SECTOR = "ffffffff-ffff-4fff-8fff-000000000002";
export const PROF = "ffffffff-ffff-4fff-8fff-000000000003";
export const DEPTO = "ffffffff-ffff-4fff-8fff-000000000004";
export const MUNI = "ffffffff-ffff-4fff-8fff-000000000005";
export const SKILL = "ffffffff-ffff-4fff-8fff-000000000006";
export const IDIOMA = "ffffffff-ffff-4fff-8fff-000000000007";
export const LICENCIA = "ffffffff-ffff-4fff-8fff-000000000008";
export const TOKEN = "q3J8m2Zl0bX4vY7nP1sT6wK9cE5dH8aR2uF0gL4iJ7o";

export const VIGENTE = { type: "business", start_date: "2026-11-01", expiration_date: "2027-11-01", status: "active" };

export const EMPRESA = (over: Record<string, unknown> = {}) => ({
  id: CID,
  name: "Café Nuevo S.A.",
  tax_id: "1234567-8",
  website: "https://cafenuevo.example",
  phone: "+502 5555 0000",
  description: "Tostamos y vendemos café.",
  country_id: PAIS,
  employment_sector_id: SECTOR,
  verified: true,
  verified_at: "2026-11-02T10:00:00.000000Z",
  membership: VIGENTE,
  my_role: "company_admin",
  created_at: "2026-11-01T10:00:00.000000Z",
  ...over,
});

export const RECLUTADOR = (over: Record<string, unknown> = {}) => ({ id: REC, display_name: "Luis E.", position: null, role: "recruiter", joined_at: "2026-11-03T10:00:00.000000Z", ...over });
export const INVITACION = (over: Record<string, unknown> = {}) => ({ id: INV, role: "recruiter", status: "pending", expires_at: "2026-11-17T10:00:00.000000Z", created_at: "2026-11-10T10:00:00.000000Z", ...over });

export const FILA_OFERTA = (over: Record<string, unknown> = {}) => ({
  id: OFF,
  title: "Desarrollador backend",
  status: "published",
  is_confidential: false,
  vacancies: 2,
  publication_date: "2026-11-12",
  applications_count: 3,
  created_at: "2026-11-10T10:00:00.000000Z",
  ...over,
});

/** OfferDetail: OfferInput + lo calculado por el servidor. */
export const OFERTA_DETALLE = (over: Record<string, unknown> = {}) => ({
  id: OFF,
  status: "draft",
  required_driver_license: false,
  publication_date: null,
  closed_at: null,
  created_at: "2026-11-10T10:00:00.000000Z",
  updated_at: "2026-11-10T10:00:00.000000Z",
  applications_count: 0,
  created_by: { id: REC, display_name: "Ana P." },
  title: "Desarrollador backend",
  description: "Construirás APIs de pagos en Rust con el equipo.",
  is_confidential: false,
  is_experience_required: true,
  required_experience: 2,
  main_language_id: IDIOMA,
  schedule: "Lunes a viernes, 8 a 17",
  required_availability_to_travel: false,
  vacancies: 2,
  hiring_date: "2027-02-01",
  profession_id: PROF,
  employment_sector_id: SECTOR,
  job_hierarchy_id: null,
  minimum_academic_level_id: null,
  state_id: DEPTO,
  city_id: MUNI,
  salary_range_id: null,
  working_shift_id: null,
  contract_type_id: null,
  skills: [{ skill_id: SKILL, is_required: true, min_level: "intermediate" }],
  languages: [],
  driver_license_ids: [],
  ...over,
});

/** PanelRow: lo mínimo. Fuera de `available`, `applicant` es null y no viaja `shared_fields`. */
export const FILA_PANEL = (over: Record<string, unknown> = {}) => ({
  id: PAP,
  status: "applied",
  applied_at: "2026-11-13T15:00:00.123456Z",
  status_changed_at: "2026-11-13T15:00:00.123456Z",
  is_favorite: false,
  availability: "available",
  applicant: { display_name: "Ana P." },
  shared_fields: ["display_name", "skills", "experience"],
  ...over,
});
export const FILA_ANONIMA = (availability: string, over: Record<string, unknown> = {}) => {
  const f: Record<string, unknown> = { ...FILA_PANEL({ id: PAP2, availability, applicant: null, ...over }) };
  delete f.shared_fields;
  return f;
};

/** PanelApplication: solo las claves de lo compartido. */
export const DETALLE_PANEL = (over: Record<string, unknown> = {}, applicant: Record<string, unknown> = {}) => ({
  ...FILA_PANEL(),
  offer: { id: OFF, title: "Desarrollador backend" },
  applicant: {
    display_name: "Ana P.",
    skills: [{ skill: { id: SKILL, code: "rust", name: "Rust" }, level: "advanced", years_of_experience: 3 }],
    experience: [{ company: "Acme", title: "Dev", start_date: "2022-01-01", end_date: null }],
    ...applicant,
  },
  history: [{ from: null, to: "applied", at: "2026-11-13T15:00:00.123456Z", note: null }],
  ...over,
});

export const EMPRESA_ADMIN = (over: Record<string, unknown> = {}) => ({
  id: CID,
  name: "Café Nuevo S.A.",
  tax_id: "1234567-8",
  website: "https://cafenuevo.example",
  created_at: "2026-11-01T10:00:00.000000Z",
  verified_at: null,
  creator_email_domain: "cafenuevo.example",
  recruiters_count: 1,
  ...over,
});
