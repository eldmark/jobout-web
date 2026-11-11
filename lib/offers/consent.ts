/**
 * El consentimiento al aplicar (HU-52, decisión 2): explícito, por aplicación, nunca asumido. Se
 * comparten **nombres** de un conjunto cerrado; los tres mínimos siempre van.
 */
import type { ProfileData } from "@/lib/cv/types";
import { MANDATORY_FIELDS, SHARED_FIELDS, type ApplyBody, type SharedField } from "./types";

/**
 * El cuerpo de `POST /offers/{id}/applications`. Sin aceptar no hay cuerpo: nunca se manda
 * `consent: false` ni se asume. Lo marcado se filtra al conjunto cerrado y se ordena como el contrato.
 */
export function consentBody(selected: Iterable<string>, accepted: boolean): ApplyBody | null {
  if (accepted !== true) return null;
  const marcados = new Set<string>([...MANDATORY_FIELDS, ...selected]);
  return { consent: true, shared_fields: SHARED_FIELDS.filter((f) => marcados.has(f)) };
}

const lleno = (s: string | null | undefined): boolean => typeof s === "string" && s.trim() !== "";

/**
 * Qué datos tiene la persona para cada campo, para decirle «No tienes teléfono en tu perfil». El
 * nombre y el correo son de la cuenta: siempre existen. Sin perfil (no cargó), no se sabe: null.
 */
export function fieldAvailability(p: ProfileData | null): Record<SharedField, boolean | null> {
  if (!p) return Object.fromEntries(SHARED_FIELDS.map((f) => [f, null])) as Record<SharedField, null>;
  const experiencias = Array.isArray(p.experiences) ? p.experiences : [];
  return {
    display_name: true,
    skills: Array.isArray(p.skills) && p.skills.length > 0,
    experience: experiencias.length > 0,
    experience_descriptions: experiencias.some((e) => lleno(e.description)),
    languages: Array.isArray(p.languages) && p.languages.length > 0,
    education: Boolean(p.academic_level_id || p.profession_id || p.job_hierarchy_id),
    profile_description: lleno(p.description),
    email: true,
    phone: lleno(p.phone),
    // El puntaje se calcula con lo que haya; compartirlo no depende de un dato del perfil.
    match_score: true,
  };
}
