/** Funciones puras de ofertas y aplicaciones (Fase 5a, paso 11): cada una con su prueba unitaria. */
import { describe, it, expect, afterEach } from "vitest";
import { t, tf } from "@/lib/messages";
import { formatDay, formatWait, placeOf, publicCompany, revealedCompany, safeWebsite } from "@/lib/offers/format";
import { consentBody, fieldAvailability } from "@/lib/offers/consent";
import { fiveYearsBefore, todayLocal, toExternalInput, validateExternal } from "@/lib/offers/external";
import { canWithdraw, MANDATORY_FIELDS, SHARED_FIELDS } from "@/lib/offers/types";
import { navFor, parseRoles } from "@/lib/auth/menu";
import { formatDate } from "@/lib/interviews/format";
import { APLICADA, EMPRESA, GUATEMALA, MIXCO, PERFIL, PERFIL_VACIO } from "./helpers/offers";

const TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = TZ;
});

describe("fechas", () => {
  it("formatDay: una fecha AAAA-MM-DD es un día de calendario, no se corre al anterior en Guatemala", () => {
    process.env.TZ = "America/Guatemala";
    const esperado = new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeZone: "UTC" }).format(Date.UTC(2026, 10, 12));
    expect(formatDay("2026-11-12")).toBe(esperado);
    expect(formatDay("2026-11-12")).toMatch(/\b12\b/);
    expect(formatDay("2026-11-12")).not.toMatch(/\b11\b/);
  });
  it("formatDay: lo que no es una fecha no produce texto roto", () => {
    for (const x of ["", "mañana", "2026-13-01", "2026-02-30", "2026-11-12T00:00:00Z"]) expect(formatDay(x), x).toBe("");
  });
  it("las fechas del backend traen microsegundos y igual se formatean", () => {
    expect(formatDate(APLICADA)).not.toBe("");
  });
  it("formatWait: los segundos de Retry-After en minutos u horas, redondeando hacia arriba", () => {
    expect(formatWait(30)).toBe(t("offers.wait.minute"));
    expect(formatWait(60)).toBe(t("offers.wait.minute"));
    expect(formatWait(61)).toBe(tf("offers.wait.minutes", { n: 2 }));
    expect(formatWait(3599)).toBe(tf("offers.wait.minutes", { n: 60 }));
    expect(formatWait(3600)).toBe(t("offers.wait.hour"));
    expect(formatWait(3601)).toBe(tf("offers.wait.hours", { n: 2 }));
    expect(formatWait(86400)).toBe(tf("offers.wait.hours", { n: 24 }));
  });
});

describe("empresa y lugar (CA3, AP9)", () => {
  it("publicCompany: una oferta confidencial nunca muestra empresa, aunque la API la trajera", () => {
    expect(publicCompany({ confidential: false, company: EMPRESA })).toEqual(EMPRESA);
    expect(publicCompany({ confidential: true, company: null })).toBeNull();
    expect(publicCompany({ confidential: true, company: EMPRESA })).toBeNull();
  });
  it("revealedCompany: en una aplicación la empresa aparece solo si la API la devuelve (revelada al preseleccionar)", () => {
    expect(revealedCompany({ confidential: true, company: null })).toBeNull();
    expect(revealedCompany({ confidential: true, company: EMPRESA })).toEqual(EMPRESA);
    expect(revealedCompany({ confidential: false, company: EMPRESA })).toEqual(EMPRESA);
  });
  it("placeOf: municipio y departamento, o lo que haya", () => {
    expect(placeOf({ state: GUATEMALA, city: MIXCO })).toBe("Mixco, Guatemala");
    expect(placeOf({ state: GUATEMALA, city: null })).toBe("Guatemala");
    expect(placeOf({ state: null, city: null })).toBe("");
  });
  it("safeWebsite: solo enlaces http(s); un javascript: o un texto suelto no son enlaces", () => {
    expect(safeWebsite("https://cafenuevo.example")).toBe("https://cafenuevo.example/");
    expect(safeWebsite("http://a.example/x?y=1")).toBe("http://a.example/x?y=1");
    for (const malo of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<b>x</b>", "cafenuevo.example", "//evil.example", "", null, undefined]) {
      expect(safeWebsite(malo as string | null), String(malo)).toBeNull();
    }
  });
});

describe("consentimiento (AP2, AP6)", () => {
  it("el conjunto cerrado son nueve nombres y tres obligatorios", () => {
    expect(SHARED_FIELDS).toEqual(["display_name", "skills", "experience", "experience_descriptions", "languages", "education", "profile_description", "email", "phone"]);
    expect(MANDATORY_FIELDS).toEqual(["display_name", "skills", "experience"]);
  });
  it("sin aceptar no hay cuerpo: nunca se manda consent false ni se asume", () => {
    expect(consentBody(["email"], false)).toBeNull();
  });
  it("aceptado: consent es el booleano true y van los obligatorios más lo marcado, en el orden del contrato", () => {
    expect(consentBody(["phone", "email", "languages"], true)).toEqual({
      consent: true,
      shared_fields: ["display_name", "skills", "experience", "languages", "email", "phone"],
    });
    expect(consentBody([], true)).toEqual({ consent: true, shared_fields: ["display_name", "skills", "experience"] });
  });
  it("un nombre fuera del conjunto o repetido no se cuela", () => {
    expect(consentBody(["email", "email", "address", "match_score"], true)?.shared_fields).toEqual(["display_name", "skills", "experience", "email"]);
  });
  it("fieldAvailability: qué datos tiene la persona en su perfil (para «No tienes teléfono en tu perfil»)", () => {
    const todo = fieldAvailability(PERFIL());
    for (const f of SHARED_FIELDS) expect(todo[f], f).toBe(true);
    const nada = fieldAvailability(PERFIL_VACIO as never);
    expect(nada).toMatchObject({ display_name: true, email: true, skills: false, experience: false, experience_descriptions: false, languages: false, education: false, profile_description: false, phone: false });
  });
  it("fieldAvailability: descripción o teléfono en blanco cuentan como que no hay; sin perfil, no se sabe", () => {
    const blancos = fieldAvailability(PERFIL({ phone: "  ", description: "", experiences: [{ company: "A", title: "B", start_date: "2021-01-01", end_date: null, description: null }] }));
    expect(blancos).toMatchObject({ phone: false, profile_description: false, experience: true, experience_descriptions: false });
    const desconocido = fieldAvailability(null);
    for (const f of SHARED_FIELDS) expect(desconocido[f], f).toBeNull();
  });
  it("canWithdraw: solo desde applied, under_review o shortlisted", () => {
    expect(["applied", "under_review", "shortlisted"].every((s) => canWithdraw(s as never))).toBe(true);
    expect(["rejected", "withdrawn", "hired"].some((s) => canWithdraw(s as never))).toBe(false);
  });
});

describe("registro externo: validación antes de enviar", () => {
  const HOY = "2026-11-10";
  const bueno = { company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "interviewing", notes: "" };
  it("un registro válido no tiene errores", () => {
    expect(validateExternal(bueno, HOY)).toEqual({});
  });
  it("empresa y puesto de 2 a 120 caracteres Unicode, recortados", () => {
    expect(validateExternal({ ...bueno, company_name: " X " }, HOY)).toEqual({ company_name: "external.error.company" });
    expect(validateExternal({ ...bueno, position: "a".repeat(121) }, HOY)).toEqual({ position: "external.error.position" });
    expect(validateExternal({ ...bueno, company_name: "😀".repeat(120) }, HOY)).toEqual({});
  });
  it("la fecha va de hoy a cinco años atrás", () => {
    expect(validateExternal({ ...bueno, applied_on: "2026-11-11" }, HOY)).toEqual({ applied_on: "external.error.appliedOn" });
    expect(validateExternal({ ...bueno, applied_on: "2021-11-09" }, HOY)).toEqual({ applied_on: "external.error.appliedOn" });
    expect(validateExternal({ ...bueno, applied_on: "2021-11-10" }, HOY)).toEqual({});
    expect(validateExternal({ ...bueno, applied_on: "" }, HOY)).toEqual({ applied_on: "external.error.appliedOn" });
  });
  it("el estado es uno de los seis; las notas hasta 2000 caracteres", () => {
    expect(validateExternal({ ...bueno, status: "" }, HOY)).toEqual({ status: "external.error.status" });
    expect(validateExternal({ ...bueno, notes: "ñ".repeat(2001) }, HOY)).toEqual({ notes: "external.error.notes" });
    expect(validateExternal({ ...bueno, notes: "ñ".repeat(2000) }, HOY)).toEqual({});
  });
  it("fiveYearsBefore: el 29 de febrero cae en el 28 si ese año no es bisiesto", () => {
    expect(fiveYearsBefore("2026-11-10")).toBe("2021-11-10");
    expect(fiveYearsBefore("2028-02-29")).toBe("2023-02-28");
  });
  it("todayLocal: la fecha del día en la zona de la persona", () => {
    expect(todayLocal(new Date(2026, 10, 10, 23, 30))).toBe("2026-11-10");
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });
  it("toExternalInput: recorta y unas notas vacías viajan como null", () => {
    expect(toExternalInput({ ...bueno, company_name: "  Banco X ", notes: "   " })).toEqual({ ...bueno, notes: null });
    expect(toExternalInput({ ...bueno, notes: " hola " })).toEqual({ ...bueno, notes: "hola" });
  });
});

describe("FC6: el menú sale de los roles de /me", () => {
  it("un candidato ve ofertas y sus aplicaciones", () => {
    expect(navFor(["applicant"]).map((l) => l.href)).toEqual(["/offers", "/applications"]);
  });
  it("candidato y reclutador a la vez (decisión 10): conserva el menú de candidato; el del reclutador llega con sus páginas", () => {
    expect(navFor(["applicant", "company_admin"]).map((l) => l.href)).toEqual(["/offers", "/applications"]);
    expect(navFor(["applicant", "recruiter"]).map((l) => l.href)).toEqual(["/offers", "/applications"]);
  });
  it("sin el rol de candidato no hay menú de candidato; nada supone un rol", () => {
    expect(navFor(["admin"])).toEqual([]);
    expect(navFor([])).toEqual([]);
  });
  it("parseRoles: solo cadenas; cualquier otra forma es una lista vacía", () => {
    expect(parseRoles(["applicant", 5, null, "recruiter"])).toEqual(["applicant", "recruiter"]);
    for (const x of [undefined, null, "applicant", { applicant: true }]) expect(parseRoles(x)).toEqual([]);
  });
});
