/**
 * Reglas del lado empresa que el frontend necesita para explicar antes de llamar: si la empresa puede
 * publicar (FC8), qué transiciones admite una aplicación (PA4, PA5), qué falta para publicar (OF5), qué
 * queda congelado (OF7) y la validación de los formularios con los topes del backend. El backend decide
 * siempre; esto solo evita llamadas que van a fallar y dice por qué.
 */
import { t, type MessageKey } from "@/lib/messages";
import { countChars } from "@/lib/interviews/types";
import { formatDay } from "@/lib/offers/format";
import type { Proficiency, SkillLevel } from "@/lib/cv/types";
import { OFFER_INPUT_KEYS, OFFER_STATUSES, type Availability, type Company, type OfferDetail, type OfferInput, type OfferStatus, type PanelRow, type PublishField, type RecruiterTarget } from "./types";

// ------------------------------------------------------------------ empresa

export type CompanyGate = "ok" | "unverified" | "noMembership" | "expired";

/** FC8: sin verificar gana; después, sin membresía o con la membresía vencida. */
export function companyGate(c: Pick<Company, "verified" | "membership">): CompanyGate {
  if (!c.verified) return "unverified";
  if (!c.membership) return "noMembership";
  return c.membership.status === "active" ? "ok" : "expired";
}

export interface CompanyForm {
  name: string;
  tax_id: string;
  website: string;
  phone: string;
  description: string;
  country_id: string;
  employment_sector_id: string;
}
export type CompanyErrors = Partial<Record<keyof CompanyForm, MessageKey>>;

export const emptyCompanyForm = (): CompanyForm => ({ name: "", tax_id: "", website: "", phone: "", description: "", country_id: "", employment_sector_id: "" });

export const fromCompany = (c: Company): CompanyForm => ({
  name: c.name,
  tax_id: c.tax_id,
  website: c.website ?? "",
  phone: c.phone ?? "",
  description: c.description ?? "",
  country_id: c.country_id,
  employment_sector_id: c.employment_sector_id,
});

const vacioANull = (s: string) => (s.trim() === "" ? null : s.trim());

export const toCompanyInput = (f: CompanyForm) => ({
  name: f.name.trim(),
  tax_id: f.tax_id.trim(),
  website: vacioANull(f.website),
  phone: vacioANull(f.phone),
  description: vacioANull(f.description),
  country_id: f.country_id,
  employment_sector_id: f.employment_sector_id,
});

/** Los límites de `CompanyInput` (api.md). */
export function validateCompany(f: CompanyForm): CompanyErrors {
  const e: CompanyErrors = {};
  const nombre = countChars(f.name.trim());
  if (nombre < 2 || nombre > 120) e.name = "companyForm.error.name";
  if (!/^[A-Za-z0-9 -]{4,20}$/.test(f.tax_id.trim())) e.tax_id = "companyForm.error.taxId";
  const web = f.website.trim();
  if (web !== "" && (!/^https:\/\/\S+$/i.test(web) || web.length > 200)) e.website = "companyForm.error.website";
  if (countChars(f.phone.trim()) > 20) e.phone = "companyForm.error.phone";
  if (countChars(f.description.trim()) > 2000) e.description = "companyForm.error.description";
  if (!f.country_id) e.country_id = "companyForm.error.country";
  if (!f.employment_sector_id) e.employment_sector_id = "companyForm.error.sector";
  return e;
}

// ------------------------------------------------------------------ fechas

const DIA_MS = 86_400_000;
const aMs = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));

/** La misma fecha dentro de dos años (el 29 de febrero cae en el 28 si el año no es bisiesto). */
function dosAnosDespues(ymd: string): string {
  const y = Number(ymd.slice(0, 4)) + 2;
  const bisiesto = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const md = ymd.slice(5) === "02-29" && !bisiesto ? "02-28" : ymd.slice(5);
  return `${y}-${md}`;
}

/** Membresía: fechas reales, el fin no antes del inicio y a lo sumo 400 días después. */
export function validateMembership(start: string, end: string): MessageKey | null {
  if (!formatDay(start) || !formatDay(end)) return "admin.membership.error";
  const dias = (aMs(end) - aMs(start)) / DIA_MS;
  return dias < 0 || dias > 400 ? "admin.membership.error" : null;
}

// ------------------------------------------------------------------ panel

const TRANSICIONES: Record<string, RecruiterTarget[]> = {
  applied: ["under_review"],
  under_review: ["shortlisted", "rejected"],
  shortlisted: ["hired", "rejected"],
};

/** Lo que el reclutador puede hacer con una aplicación. Una no disponible no se mueve (paso 7). */
export function nextStatuses(r: Pick<PanelRow, "status" | "availability">): RecruiterTarget[] {
  if (r.availability !== "available") return [];
  return TRANSICIONES[r.status] ?? [];
}

/** El texto de una entrada anónima (PA10), o null si está disponible. */
export function availabilityKey(a: Availability): MessageKey | null {
  switch (a) {
    case "deleted":
      return "panel.availability.deleted";
    case "withdrawn":
      return "panel.availability.withdrawn";
    case "retention_expired":
      return "panel.availability.retention_expired";
    default:
      return null;
  }
}

// ------------------------------------------------------------------ ofertas

type Publicable = Pick<OfferInput, "title" | "description" | "vacancies" | "profession_id" | "state_id" | "city_id" | "skills" | "languages" | "driver_license_ids" | "hiring_date">;

/** OF5: lo que falta para publicar, con los nombres y en el orden de `fields` del backend. */
export function missingToPublish(o: Publicable, today: string): PublishField[] {
  const faltan: PublishField[] = [];
  if (!o.title || o.title.trim() === "") faltan.push("title");
  if (!o.description) faltan.push("description");
  if (o.vacancies === null || o.vacancies === undefined) faltan.push("vacancies");
  if (!o.profession_id) faltan.push("profession_id");
  if (!o.state_id) faltan.push("state_id");
  if (!o.city_id) faltan.push("city_id");
  if (o.skills.length + o.languages.length + o.driver_license_ids.length === 0) faltan.push("requirements");
  if (o.hiring_date && o.hiring_date < today) faltan.push("hiring_date");
  return faltan;
}

const SIEMPRE_EDITABLES: readonly (keyof OfferInput)[] = ["description", "schedule", "vacancies", "hiring_date"];

/** OF7: desde la primera aplicación solo se editan cuatro campos; `is_confidential` queda fijo desde la primera publicación. */
export function frozenFields(d: Pick<OfferDetail, "applications_count" | "publication_date">): Set<keyof OfferInput> {
  if (d.applications_count > 0) return new Set(OFFER_INPUT_KEYS.filter((k) => !SIEMPRE_EDITABLES.includes(k)));
  return new Set(d.publication_date ? (["is_confidential"] as const) : []);
}

/** El estado de una oferta en español; uno fuera del contrato da cadena vacía en vez de romper la página. */
export function offerStatusLabel(s: string): string {
  return (OFFER_STATUSES as readonly string[]).includes(s) ? t(`companyOffers.status.${s as OfferStatus}`) : "";
}

/** OF6: qué transiciones admite la oferta, y borrar solo un borrador sin aplicaciones. */
export function offerActions(d: Pick<OfferDetail, "status" | "applications_count">) {
  return {
    publish: d.status === "draft" || d.status === "paused",
    pause: d.status === "published",
    close: d.status === "published" || d.status === "paused",
    remove: d.status === "draft" && d.applications_count === 0,
  };
}

/** El formulario tal como se edita (los números y fechas como texto). */
export interface OfferForm {
  title: string;
  description: string;
  is_confidential: boolean;
  is_experience_required: boolean;
  required_experience: string;
  main_language_id: string;
  schedule: string;
  required_availability_to_travel: boolean;
  vacancies: string;
  hiring_date: string;
  profession_id: string;
  employment_sector_id: string;
  job_hierarchy_id: string;
  minimum_academic_level_id: string;
  state_id: string;
  city_id: string;
  salary_range_id: string;
  working_shift_id: string;
  contract_type_id: string;
  skills: Array<{ skill_id: string; is_required: boolean; min_level: string }>;
  languages: Array<{ language_id: string; min_proficiency: string }>;
  driver_license_ids: string[];
}
export type OfferErrors = Partial<Record<keyof OfferForm, MessageKey>>;

const IDS = ["main_language_id", "profession_id", "employment_sector_id", "job_hierarchy_id", "minimum_academic_level_id", "state_id", "city_id", "salary_range_id", "working_shift_id", "contract_type_id"] as const;

export const emptyOfferForm = (): OfferForm => ({
  title: "",
  description: "",
  is_confidential: false,
  is_experience_required: false,
  required_experience: "",
  main_language_id: "",
  schedule: "",
  required_availability_to_travel: false,
  vacancies: "",
  hiring_date: "",
  profession_id: "",
  employment_sector_id: "",
  job_hierarchy_id: "",
  minimum_academic_level_id: "",
  state_id: "",
  city_id: "",
  salary_range_id: "",
  working_shift_id: "",
  contract_type_id: "",
  skills: [],
  languages: [],
  driver_license_ids: [],
});

export function fromOfferDetail(d: OfferInput): OfferForm {
  const f = emptyOfferForm();
  for (const k of IDS) f[k] = d[k] ?? "";
  return {
    ...f,
    title: d.title ?? "",
    description: d.description ?? "",
    is_confidential: Boolean(d.is_confidential),
    is_experience_required: Boolean(d.is_experience_required),
    required_experience: d.required_experience === null || d.required_experience === undefined ? "" : String(d.required_experience),
    schedule: d.schedule ?? "",
    required_availability_to_travel: Boolean(d.required_availability_to_travel),
    vacancies: d.vacancies === null || d.vacancies === undefined ? "" : String(d.vacancies),
    hiring_date: d.hiring_date ?? "",
    skills: (d.skills ?? []).map((s) => ({ skill_id: s.skill_id, is_required: s.is_required, min_level: s.min_level ?? "" })),
    languages: (d.languages ?? []).map((l) => ({ language_id: l.language_id, min_proficiency: l.min_proficiency ?? "" })),
    driver_license_ids: [...(d.driver_license_ids ?? [])],
  };
}

const entero = (s: string) => (s.trim() === "" ? null : Number(s));

/** Lo que viaja: recortado, lo vacío como null; sin experiencia exigida no hay años. */
export function toOfferInput(f: OfferForm): OfferInput {
  const ids = Object.fromEntries(IDS.map((k) => [k, f[k] || null])) as Record<(typeof IDS)[number], string | null>;
  return {
    title: f.title.trim(),
    description: vacioANull(f.description),
    is_confidential: f.is_confidential,
    is_experience_required: f.is_experience_required,
    required_experience: f.is_experience_required ? entero(f.required_experience) : null,
    schedule: vacioANull(f.schedule),
    required_availability_to_travel: f.required_availability_to_travel,
    vacancies: entero(f.vacancies),
    hiring_date: f.hiring_date || null,
    ...ids,
    skills: f.skills.map((s) => ({ skill_id: s.skill_id, is_required: s.is_required, min_level: (s.min_level || null) as SkillLevel | null })),
    languages: f.languages.map((l) => ({ language_id: l.language_id, min_proficiency: (l.min_proficiency || null) as Proficiency | null })),
    driver_license_ids: [...f.driver_license_ids],
  };
}

const enRango = (s: string, min: number, max: number) => /^\d+$/.test(s.trim()) && Number(s) >= min && Number(s) <= max;
const repetidos = (xs: string[]) => new Set(xs).size !== xs.length;

/** Los topes de `OfferInput` (api.md). `today` es `AAAA-MM-DD`. */
export function validateOffer(f: OfferForm, today: string): OfferErrors {
  const e: OfferErrors = {};
  const titulo = countChars(f.title.trim());
  if (titulo < 3 || titulo > 120) e.title = "offerForm.error.title";
  const desc = countChars(f.description.trim());
  if (desc !== 0 && (desc < 20 || desc > 5000)) e.description = "offerForm.error.description";
  if (f.is_experience_required && !enRango(f.required_experience, 0, 50)) e.required_experience = "offerForm.error.experience";
  if (countChars(f.schedule.trim()) > 120) e.schedule = "offerForm.error.schedule";
  if (f.vacancies.trim() !== "" && !enRango(f.vacancies, 1, 999)) e.vacancies = "offerForm.error.vacancies";
  if (f.hiring_date && (!formatDay(f.hiring_date) || f.hiring_date < today || f.hiring_date > dosAnosDespues(today))) e.hiring_date = "offerForm.error.hiringDate";
  if (f.skills.length > 30 || repetidos(f.skills.map((s) => s.skill_id))) e.skills = "offerForm.error.skills";
  if (f.languages.length > 5 || repetidos(f.languages.map((l) => l.language_id))) e.languages = "offerForm.error.languages";
  if (f.driver_license_ids.length > 5) e.driver_license_ids = "offerForm.error.licenses";
  return e;
}
