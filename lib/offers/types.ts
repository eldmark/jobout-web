/**
 * Contrato de ofertas y aplicaciones para candidatos (Fase 5a): `jobout-docs/documentation/api.md`,
 * «Ofertas para candidatos», «Aplicar, ver y retirar (candidato)» y «Registro de aplicaciones
 * externas». Listados `{items, next_cursor}` con cursor opaco. Sin matching: eso es de la 5b.
 */
import type { Proficiency, SkillLevel } from "@/lib/cv/types";

export interface CatalogRef {
  id: string;
  code: string;
  name: string;
}

/** Solo viene si la oferta no es confidencial (o, en una aplicación, si ya se reveló). */
export interface Company {
  id: string;
  name: string;
  /** Texto escrito por la empresa: se valida antes de usarlo como enlace (`safeWebsite`). */
  website: string | null;
}

export const APPLICATION_STATUSES = ["applied", "under_review", "shortlisted", "rejected", "withdrawn", "hired"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** La persona solo puede retirar desde estos estados (la máquina de estados de `api.md`). */
export const WITHDRAWABLE: readonly ApplicationStatus[] = ["applied", "under_review", "shortlisted"];
export const canWithdraw = (s: ApplicationStatus): boolean => WITHDRAWABLE.includes(s);

export interface OfferSummary {
  id: string;
  title: string;
  confidential: boolean;
  company: Company | null;
  profession: CatalogRef | null;
  employment_sector: CatalogRef | null;
  state: CatalogRef | null;
  city: CatalogRef | null;
  contract_type: CatalogRef | null;
  salary_range: CatalogRef | null;
  working_shift: CatalogRef | null;
  vacancies: number;
  /** `AAAA-MM-DD`. */
  publication_date: string;
  /** Mi aplicación a esta oferta, o null si no apliqué. */
  my_application: { id: string; status: ApplicationStatus } | null;
}

export interface OfferPublic extends OfferSummary {
  description: string;
  schedule: string | null;
  /** `AAAA-MM-DD`. */
  hiring_date: string | null;
  required_experience: number | null;
  required_availability_to_travel: boolean;
  required_driver_license: boolean;
  main_language: CatalogRef | null;
  job_hierarchy: CatalogRef | null;
  minimum_academic_level: CatalogRef | null;
  skills: Array<{ skill: CatalogRef; is_required: boolean; min_level: SkillLevel | null }>;
  languages: Array<{ language: CatalogRef; min_proficiency: Proficiency | null }>;
  driver_licenses: CatalogRef[];
}

export interface Page<T> {
  items: T[];
  /** null en la última página. */
  next_cursor: string | null;
}

/** Los únicos filtros de `GET /offers` (no discriminación: conjunto cerrado). */
export const OFFER_FILTERS = ["profession_id", "state_id", "city_id", "contract_type_id", "salary_range_id", "working_shift_id", "employment_sector_id", "job_hierarchy_id"] as const;
export type OfferFilter = (typeof OFFER_FILTERS)[number];
export const OFFER_SORTS = ["recent", "oldest"] as const;
export type OfferSort = (typeof OFFER_SORTS)[number];

export interface OfferQuery {
  /** 1–50 (defecto del backend: 20). */
  limit?: number;
  cursor?: string;
  sort?: OfferSort;
  filters?: Partial<Record<OfferFilter, string>>;
}

/** El conjunto cerrado de lo que se puede compartir al aplicar, en el orden canónico del contrato. */
export const SHARED_FIELDS = ["display_name", "skills", "experience", "experience_descriptions", "languages", "education", "profile_description", "email", "phone"] as const;
export type SharedField = (typeof SHARED_FIELDS)[number];
/** Siempre van: sin ellos el reclutador no tiene con qué evaluar. */
export const MANDATORY_FIELDS: readonly SharedField[] = ["display_name", "skills", "experience"];

export interface ApplyBody {
  consent: true;
  shared_fields: SharedField[];
}

export interface ApplicationOffer {
  id: string;
  title: string;
  status: "published" | "paused" | "closed";
  confidential: boolean;
  company: Company | null;
  state: CatalogRef | null;
  city: CatalogRef | null;
}

export interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  status_changed_at: string;
  consented_at: string;
  offer: ApplicationOffer;
}

/** `GET /me/applications/{id}`: el resumen más lo compartido y el historial (`{status, at}`, nada más). */
export interface Application extends ApplicationSummary {
  shared_fields: SharedField[];
  history: Array<{ status: ApplicationStatus; at: string }>;
}

export interface ListParams<S extends string> {
  limit?: number;
  cursor?: string;
  status?: S;
}

export const EXTERNAL_STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn", "accepted"] as const;
export type ExternalStatus = (typeof EXTERNAL_STATUSES)[number];

/** Lo que se envía en `POST`/`PUT /me/external-applications`. */
export interface ExternalInput {
  company_name: string;
  position: string;
  /** `AAAA-MM-DD`, de hoy a cinco años atrás. */
  applied_on: string;
  status: ExternalStatus;
  notes: string | null;
}

export interface External extends ExternalInput {
  id: string;
  created_at: string;
}

/** Topes del registro externo (`external_applications.rs`). */
export const EXTERNAL_LIMITS = { nameMin: 2, nameMax: 120, notesMax: 2000, years: 5 } as const;
