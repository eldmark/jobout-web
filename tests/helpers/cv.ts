import { vi } from "vitest";
import { act } from "@testing-library/react";
import { jsonRes } from "./backend";

export const CV_ID = "11111111-1111-4111-8111-111111111111";
export const SKILLS = [
  { id: "s-rust", code: "rust", name: "Rust" },
  { id: "s-sql", code: "sql", name: "SQL" },
  { id: "s-docker", code: "docker", name: "Docker" },
  { id: "s-react", code: "react", name: "React" },
];
export const LANGS = [
  { id: "l-en", code: "en", name: "Inglés" },
  { id: "l-es", code: "es", name: "Español" },
];
export const NIVELES = [{ id: "a-1", code: "grado", name: "Grado" }];
export const PROFESIONES = [{ id: "p-1", code: "backend", name: "Backend" }];
export const JERARQUIAS = [{ id: "j-1", code: "senior", name: "Senior" }];

export const PROPUESTA = {
  description: "Desarrollo backend",
  skills: [
    { skill_id: "s-rust", code: "rust", name: "Rust", confidence: "alta" },
    { skill_id: "s-sql", code: "sql", name: "SQL", confidence: "baja" },
  ],
  languages: [{ language_id: "l-en", code: "en", name: "Inglés", proficiency: "advanced", to_confirm: true, confidence: "media" }],
  experiences: [{ company: "Acme", title: "Dev", start_date: "2021-01-01", end_date: null, description: null, confidence: "alta" }],
};
export const CREADO = (extraction: unknown = { status: "ready", reason: null, proposal: PROPUESTA }) => ({
  id: CV_ID,
  version: 1,
  is_primary: true,
  original_filename: "cv.pdf",
  size_bytes: 1000,
  created_at: "2026-11-05T10:00:00Z",
  extraction,
});

export function catalogoPorUrl(url: string): Response | null {
  const m = url.match(/^\/api\/catalogs\/(.+)$/);
  if (!m) return null;
  const mapa: Record<string, unknown> = { skills: SKILLS, languages: LANGS, "academic-levels": NIVELES, professions: PROFESIONES, "job-hierarchies": JERARQUIAS };
  return jsonRes(200, mapa[m[1]] ?? []);
}

/** XMLHttpRequest simulado: la prueba decide cuándo avanza y cuándo termina. */
export class FakeXHR {
  static instancias: FakeXHR[] = [];
  static get last(): FakeXHR {
    return FakeXHR.instancias[FakeXHR.instancias.length - 1];
  }
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  method = "";
  url = "";
  body: unknown = null;
  open = vi.fn((m: string, u: string) => {
    this.method = m;
    this.url = u;
  });
  setRequestHeader = vi.fn();
  send = vi.fn((b: unknown) => {
    this.body = b;
  });
  abort = vi.fn();
  constructor() {
    FakeXHR.instancias.push(this);
  }
  progreso(loaded: number, total: number) {
    act(() => this.upload.onprogress?.({ lengthComputable: true, loaded, total }));
  }
  terminar(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    act(() => this.onload?.());
  }
  fallarRed() {
    act(() => this.onerror?.());
  }
}

export function archivo(nombre: string, tipo: string, bytes = 100): File {
  const f = new File([new Uint8Array(Math.min(bytes, 100))], nombre, { type: tipo });
  Object.defineProperty(f, "size", { value: bytes });
  return f;
}
export const PDF = () => archivo("cv.pdf", "application/pdf");
