export type Confianza = "alta" | "media" | "baja";
export type Proficiency = "native" | "advanced" | "intermediate" | "basic";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface CvSummary {
  id: string;
  version: number;
  is_primary: boolean;
  original_filename: string;
  size_bytes: number;
  created_at: string;
}

export interface Proposal {
  description: string | null;
  skills: Array<{ skill_id: string; name: string; confidence: Confianza; level?: SkillLevel | null }>;
  languages: Array<{ language_id: string; name: string; proficiency: Proficiency; to_confirm: boolean; confidence: Confianza }>;
  experiences: Array<{ company: string; title: string; start_date: string; end_date: string | null; description: string | null; confidence: Confianza }>;
}

export interface Extraction {
  status: "ready" | "failed";
  reason: "sin_texto" | "ilegible" | "tiempo_agotado" | null;
  proposal: Proposal | null;
}

export interface UploadedCv extends CvSummary {
  extraction: Extraction;
}

/** Perfil tal como lo envían GET/PUT /profile. */
export interface ProfileData {
  description: string | null;
  phone: string | null;
  academic_level_id: string | null;
  profession_id: string | null;
  job_hierarchy_id: string | null;
  skills: Array<{ skill_id: string; level: SkillLevel | null; years_of_experience?: number | null }>;
  languages: Array<{ language_id: string; proficiency: Proficiency }>;
  experiences: Array<{ company: string; title: string; start_date: string; end_date: string | null; description: string | null }>;
  extra_knowledge?: string | null;
}
