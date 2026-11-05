/** Estado y reglas del formulario de perfil (sin React): se prueba y se reutiliza en revisión y perfil. */
import type { MessageKey } from "@/lib/messages";
import type { CatalogItem, Confianza, ProfileData, Proficiency, Proposal, SkillLevel } from "./types";

export interface FormSkill {
  skill_id: string;
  name: string;
  level: SkillLevel | null;
  years: number | null;
  confidence?: Confianza;
}
export interface FormLang {
  key: string;
  language_id: string;
  name: string;
  proficiency: Proficiency;
  confidence?: Confianza;
  to_confirm?: boolean;
}
export interface FormExp {
  key: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  confidence?: Confianza;
}
export interface FormState {
  description: string;
  phone: string;
  academic_level_id: string;
  profession_id: string;
  job_hierarchy_id: string;
  skills: FormSkill[];
  languages: FormLang[];
  experiences: FormExp[];
}
export interface Catalogs {
  skills: CatalogItem[];
  languages: CatalogItem[];
  academic: CatalogItem[];
  professions: CatalogItem[];
  hierarchies: CatalogItem[];
}

export const EMPTY_CATALOGS: Catalogs = { skills: [], languages: [], academic: [], professions: [], hierarchies: [] };
export const DESC_MAX = 2000;
export const PHONE_RE = /^[0-9+\s\-()]{1,20}$/;
export const LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];
export const PROFICIENCIES: Proficiency[] = ["native", "advanced", "intermediate", "basic"];

let contador = 0;
export const nuevaClave = () => `k${++contador}`;

export const emptyForm = (): FormState => ({
  description: "",
  phone: "",
  academic_level_id: "",
  profession_id: "",
  job_hierarchy_id: "",
  skills: [],
  languages: [],
  experiences: [],
});

export const blankExperience = (): FormExp => ({ key: nuevaClave(), company: "", title: "", start_date: "", end_date: "", description: "" });
export const blankLanguage = (): FormLang => ({ key: nuevaClave(), language_id: "", name: "", proficiency: "intermediate" });

export function fromProposal(p: Proposal | null): FormState {
  const f = emptyForm();
  if (!p) return f;
  f.description = p.description ?? "";
  f.skills = p.skills.map((s) => ({ skill_id: s.skill_id, name: s.name, level: s.level ?? null, years: null, confidence: s.confidence }));
  f.languages = p.languages.map((l) => ({ key: nuevaClave(), language_id: l.language_id, name: l.name, proficiency: l.proficiency, confidence: l.confidence, to_confirm: l.to_confirm }));
  f.experiences = p.experiences.map((e) => ({
    key: nuevaClave(),
    company: e.company,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date ?? "",
    description: e.description ?? "",
    confidence: e.confidence,
  }));
  return f;
}

export function fromProfile(p: ProfileData, c: Catalogs): FormState {
  const nombre = (lista: CatalogItem[], id: string) => lista.find((x) => x.id === id)?.name ?? "";
  return {
    description: p.description ?? "",
    phone: p.phone ?? "",
    academic_level_id: p.academic_level_id ?? "",
    profession_id: p.profession_id ?? "",
    job_hierarchy_id: p.job_hierarchy_id ?? "",
    skills: p.skills.map((s) => ({ skill_id: s.skill_id, name: nombre(c.skills, s.skill_id), level: s.level ?? null, years: s.years_of_experience ?? null })),
    languages: p.languages.map((l) => ({ key: nuevaClave(), language_id: l.language_id, name: nombre(c.languages, l.language_id), proficiency: l.proficiency })),
    experiences: p.experiences.map((e) => ({ key: nuevaClave(), company: e.company, title: e.title, start_date: e.start_date, end_date: e.end_date ?? "", description: e.description ?? "" })),
  };
}

/** Errores por id de campo, en el orden en que aparecen en pantalla (el primero recibe el foco). */
export type FieldErrors = Array<{ id: string; key: MessageKey }>;

export const fieldId = (...partes: string[]) => ["f", ...partes].join("-");

export function validate(f: FormState, withProfileFields: boolean): FieldErrors {
  const errs: FieldErrors = [];
  if (f.description.length > DESC_MAX) errs.push({ id: fieldId("description"), key: "form.error.tooLong" });
  if (withProfileFields && f.phone.trim() && !PHONE_RE.test(f.phone.trim())) errs.push({ id: fieldId("phone"), key: "form.error.phone" });
  for (const e of f.experiences) {
    if (!e.company.trim()) errs.push({ id: fieldId(e.key, "company"), key: "form.error.required" });
    if (!e.title.trim()) errs.push({ id: fieldId(e.key, "title"), key: "form.error.required" });
    if (!e.start_date) errs.push({ id: fieldId(e.key, "start"), key: "form.error.required" });
    else if (e.end_date && e.end_date < e.start_date) errs.push({ id: fieldId(e.key, "end"), key: "form.error.dates" });
    if (e.description.length > DESC_MAX) errs.push({ id: fieldId(e.key, "description"), key: "form.error.tooLong" });
  }
  return errs;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** Cuerpo para la API. Las filas de idioma sin idioma elegido se descartan. */
export function toPayload(f: FormState, withProfileFields: boolean) {
  const base = {
    description: orNull(f.description),
    skills: f.skills.map((s) => ({ skill_id: s.skill_id, level: s.level, ...(s.years != null ? { years_of_experience: s.years } : {}) })),
    languages: f.languages.filter((l) => l.language_id).map((l) => ({ language_id: l.language_id, proficiency: l.proficiency })),
    experiences: f.experiences.map((e) => ({
      company: e.company.trim(),
      title: e.title.trim(),
      start_date: e.start_date,
      end_date: e.end_date || null,
      description: orNull(e.description),
    })),
  };
  if (!withProfileFields) return base;
  return {
    description: base.description,
    phone: orNull(f.phone),
    academic_level_id: f.academic_level_id || null,
    profession_id: f.profession_id || null,
    job_hierarchy_id: f.job_hierarchy_id || null,
    skills: base.skills,
    languages: base.languages,
    experiences: base.experiences,
  };
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Coincidencias del catálogo para la búsqueda: primero las que empiezan por el texto. */
export function suggestSkills(catalog: CatalogItem[], chosen: FormSkill[], query: string, limit = 6): CatalogItem[] {
  const q = normalize(query);
  const usados = new Set(chosen.map((s) => s.skill_id));
  const libres = catalog.filter((c) => !usados.has(c.id));
  if (!q) return libres.slice(0, limit);
  const hits = libres.filter((c) => normalize(c.name).includes(q) || normalize(c.code).includes(q));
  const empieza = (c: CatalogItem) => (normalize(c.name).startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => empieza(a) - empieza(b)).slice(0, limit);
}

/** Tipos y utilidades genéricas viven aquí (los .tsx evitan genéricos: el chequeo de texto literal los confunde). */
export type SubmitResult = { error: MessageKey } | { notice: MessageKey } | { done: true } | void;
export type SubmitHandler = (payload: ReturnType<typeof toPayload>) => Promise<SubmitResult>;
export type ChangedHandler = () => Promise<void>;

export function withField<K extends keyof FormState>(s: FormState, k: K, v: FormState[K]): FormState {
  return { ...s, [k]: v };
}
export function patchWhere<T>(list: T[], match: (x: T) => boolean, patch: Partial<T>): T[] {
  return list.map((x) => (match(x) ? { ...x, ...patch } : x));
}
export function languageMissing(l: FormLang, catalog: CatalogItem[]): boolean {
  return Boolean(l.language_id) && !catalog.some((c) => c.id === l.language_id);
}
