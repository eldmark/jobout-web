/**
 * Contrato del lado empresa (Fase 5a): `jobout-docs/documentation/api.md`, «Empresas, reclutadores e
 * invitaciones», «Verificación de la empresa y membresía», «Ofertas del reclutador» y «Panel del
 * reclutador» (con las precisiones del paso 7). Formas tomadas de core-api.
 */
import type { Proficiency, SkillLevel } from "@/lib/cv/types";
import type { ApplicationStatus, CatalogRef, Match, SharedField } from "@/lib/offers/types";

export type CompanyRole = "company_admin" | "recruiter";
export const COMPANY_ROLES: readonly CompanyRole[] = ["recruiter", "company_admin"];

/** `POST /companies` y `PUT /company`. */
export interface CompanyInput {
  name: string;
  tax_id: string;
  website: string | null;
  phone: string | null;
  description: string | null;
  country_id: string;
  employment_sector_id: string;
}

export interface Membership {
  type: string;
  start_date: string;
  expiration_date: string;
  /** Calculado por fechas: `active` o `expired`. */
  status: "active" | "expired";
}

export interface Company extends CompanyInput {
  id: string;
  verified: boolean;
  verified_at: string | null;
  membership: Membership | null;
  my_role: CompanyRole;
  created_at: string;
}

export interface Recruiter {
  id: string;
  /** Nombre e inicial del apellido; nunca correo ni teléfono. */
  display_name: string;
  position: string | null;
  role: CompanyRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  role: CompanyRole;
  status: "pending" | "used" | "expired";
  expires_at: string;
  created_at: string;
  /** Solo en el 201 de crearla: se muestra una vez y no se guarda. */
  token?: string;
}

export const OFFER_STATUSES = ["draft", "published", "paused", "closed"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface OfferRow {
  id: string;
  title: string;
  status: OfferStatus;
  is_confidential: boolean;
  vacancies: number | null;
  publication_date: string | null;
  applications_count: number;
  created_at: string;
}

/** `POST /company/offers` y `PUT /company/offers/{id}` (reemplazo completo). Solo `title` es obligatorio. */
export interface OfferInput {
  title: string;
  description: string | null;
  is_confidential: boolean;
  is_experience_required: boolean;
  required_experience: number | null;
  main_language_id: string | null;
  schedule: string | null;
  required_availability_to_travel: boolean;
  vacancies: number | null;
  hiring_date: string | null;
  profession_id: string | null;
  employment_sector_id: string | null;
  job_hierarchy_id: string | null;
  minimum_academic_level_id: string | null;
  state_id: string | null;
  city_id: string | null;
  salary_range_id: string | null;
  working_shift_id: string | null;
  contract_type_id: string | null;
  skills: Array<{ skill_id: string; is_required: boolean; min_level: SkillLevel | null }>;
  languages: Array<{ language_id: string; min_proficiency: Proficiency | null }>;
  driver_license_ids: string[];
}

export const OFFER_INPUT_KEYS = [
  "title",
  "description",
  "is_confidential",
  "is_experience_required",
  "required_experience",
  "main_language_id",
  "schedule",
  "required_availability_to_travel",
  "vacancies",
  "hiring_date",
  "profession_id",
  "employment_sector_id",
  "job_hierarchy_id",
  "minimum_academic_level_id",
  "state_id",
  "city_id",
  "salary_range_id",
  "working_shift_id",
  "contract_type_id",
  "skills",
  "languages",
  "driver_license_ids",
] as const satisfies readonly (keyof OfferInput)[];

export interface OfferDetail extends OfferInput {
  id: string;
  status: OfferStatus;
  required_driver_license: boolean;
  publication_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  applications_count: number;
  created_by: { id: string; display_name: string } | null;
}

/** Lo que el backend puede listar en `fields` de un 422 oferta_incompleta. */
export const PUBLISH_FIELDS = ["title", "description", "vacancies", "profession_id", "state_id", "city_id", "requirements", "hiring_date"] as const;
export type PublishField = (typeof PUBLISH_FIELDS)[number];

export type Availability = "available" | "withdrawn" | "deleted" | "retention_expired";

export interface PanelRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  status_changed_at: string;
  is_favorite: boolean;
  availability: Availability;
  /** null fuera de `available` (entrada anónima). */
  applicant: { display_name: string } | null;
  /** No viaja fuera de `available`. */
  shared_fields?: SharedField[];
}

/** Lo compartido: solo las claves marcadas (las demás no existen). */
export interface SharedApplicant {
  display_name?: string;
  skills?: Array<{ skill: CatalogRef; level: SkillLevel | null; years_of_experience: number | null }>;
  experience?: Array<{ company: string; title: string; start_date: string; end_date: string | null; description?: string | null }>;
  languages?: Array<{ language: CatalogRef; proficiency: Proficiency }>;
  education?: { academic_level: CatalogRef | null; profession: CatalogRef | null; job_hierarchy: CatalogRef | null };
  profile_description?: string | null;
  email?: string;
  phone?: string | null;
  /** Solo si la persona lo compartió (`match_score`): calculado con lo que compartió en esa aplicación. */
  match_score?: Match;
}

export interface PanelApplication extends Omit<PanelRow, "applicant"> {
  offer: { id: string; title: string };
  applicant: SharedApplicant | null;
  /** `from` es null en el primer paso; `note` es interna de la empresa. */
  history: Array<{ from: ApplicationStatus | null; to: ApplicationStatus; at: string; note: string | null }>;
}

export const PANEL_SORTS = ["recent", "oldest"] as const;
export type PanelSort = (typeof PANEL_SORTS)[number];

export interface PanelQuery {
  limit?: number;
  cursor?: string;
  status?: ApplicationStatus;
  favorite?: boolean;
  sort?: PanelSort;
}

/** El reclutador mueve a estos estados (nunca a `applied` ni a `withdrawn`). */
export const RECRUITER_TARGETS = ["under_review", "shortlisted", "rejected", "hired"] as const;
export type RecruiterTarget = (typeof RECRUITER_TARGETS)[number];

export interface AdminCompany {
  id: string;
  name: string;
  tax_id: string;
  website: string | null;
  created_at: string;
  verified_at: string | null;
  /** Solo lo que va tras la @ del correo de quien creó la empresa. */
  creator_email_domain: string | null;
  recruiters_count: number;
}

/** Tope de la nota interna de un cambio de estado (caracteres). */
export const NOTE_MAX = 500;
