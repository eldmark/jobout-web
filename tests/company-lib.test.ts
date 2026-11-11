/** Reglas puras y cliente del lado empresa (Fase 5a, paso 12): cada función con su prueba unitaria. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { CID, EMPRESA, INV, OFERTA_DETALLE, OFF, PAP, REC, SKILL, IDIOMA, LICENCIA, TOKEN, VIGENTE } from "./helpers/company";
import { t, tf } from "@/lib/messages";
import { es } from "@/lib/messages/es";
import { adminApi, companyApi, panelQuery } from "@/lib/company/client";
import { companyErrorKey, companyErrorText } from "@/lib/company/errors";
import {
  availabilityKey,
  companyGate,
  emptyOfferForm,
  fromOfferDetail,
  frozenFields,
  missingToPublish,
  nextStatuses,
  offerActions,
  toOfferInput,
  validateCompany,
  validateMembership,
  validateOffer,
} from "@/lib/company/rules";
import type { OfferDetail } from "@/lib/company/types";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const HOY = "2026-11-10";
const detalle = (over: Record<string, unknown> = {}) => OFERTA_DETALLE(over) as unknown as OfferDetail;

describe("FC8: ¿la empresa puede publicar y usar el panel?", () => {
  it("verificada y con membresía vigente: ok", () => {
    expect(companyGate(EMPRESA() as never)).toBe("ok");
  });
  it("sin verificar gana aunque tampoco haya membresía", () => {
    expect(companyGate(EMPRESA({ verified: false, verified_at: null, membership: null }) as never)).toBe("unverified");
  });
  it("verificada sin membresía, o con la membresía vencida", () => {
    expect(companyGate(EMPRESA({ membership: null }) as never)).toBe("noMembership");
    expect(companyGate(EMPRESA({ membership: { ...VIGENTE, status: "expired" } }) as never)).toBe("expired");
  });
});

describe("máquina de estados del panel (PA4, PA5, paso 7)", () => {
  it("qué puede hacer el reclutador desde cada estado", () => {
    const desde = (status: string) => nextStatuses({ status, availability: "available" } as never);
    expect(desde("applied")).toEqual(["under_review"]);
    expect(desde("under_review")).toEqual(["shortlisted", "rejected"]);
    expect(desde("shortlisted")).toEqual(["hired", "rejected"]);
    for (const final of ["hired", "rejected", "withdrawn"]) expect(desde(final), final).toEqual([]);
  });
  it("una aplicación que no está disponible (eliminada, retirada, retención vencida) no se mueve", () => {
    for (const a of ["deleted", "withdrawn", "retention_expired"]) expect(nextStatuses({ status: "under_review", availability: a } as never), a).toEqual([]);
  });
  it("cada disponibilidad anónima tiene su texto", () => {
    expect(availabilityKey("deleted")).toBe("panel.availability.deleted");
    expect(availabilityKey("withdrawn")).toBe("panel.availability.withdrawn");
    expect(availabilityKey("retention_expired")).toBe("panel.availability.retention_expired");
    expect(availabilityKey("available")).toBeNull();
  });
});

describe("ofertas: publicar, congelar y acciones (OF5, OF6, OF7)", () => {
  it("missingToPublish: lo mismo que el backend y en su orden", () => {
    expect(missingToPublish(detalle(), HOY)).toEqual([]);
    const vacia = detalle({ description: null, vacancies: null, profession_id: null, state_id: null, city_id: null, skills: [], languages: [], driver_license_ids: [], hiring_date: "2026-11-09" });
    expect(missingToPublish(vacia, HOY)).toEqual(["description", "vacancies", "profession_id", "state_id", "city_id", "requirements", "hiring_date"]);
    expect(missingToPublish(detalle({ skills: [], languages: [{ language_id: IDIOMA, min_proficiency: null }] }), HOY)).toEqual([]);
    expect(missingToPublish(detalle({ skills: [], driver_license_ids: [LICENCIA] }), HOY)).toEqual([]);
  });
  it("frozenFields: con aplicaciones solo quedan editables descripción, horario, vacantes y fecha de contratación", () => {
    expect(frozenFields(detalle()).size).toBe(0);
    const f = frozenFields(detalle({ applications_count: 1, status: "published", publication_date: "2026-11-12" }));
    for (const libre of ["description", "schedule", "vacancies", "hiring_date"]) expect(f.has(libre as never), libre).toBe(false);
    for (const fijo of ["title", "is_confidential", "skills", "state_id", "required_experience"]) expect(f.has(fijo as never), fijo).toBe(true);
  });
  it("frozenFields: «confidencial» queda fijo desde la primera publicación, aunque no haya aplicaciones", () => {
    const f = frozenFields(detalle({ status: "paused", publication_date: "2026-11-12" }));
    expect([...f]).toEqual(["is_confidential"]);
  });
  it("offerActions: publicar desde borrador o pausada; pausar publicada; cerrar publicada o pausada; borrar solo un borrador sin aplicaciones", () => {
    expect(offerActions(detalle({ status: "draft" }))).toEqual({ publish: true, pause: false, close: false, remove: true });
    expect(offerActions(detalle({ status: "published" }))).toEqual({ publish: false, pause: true, close: true, remove: false });
    expect(offerActions(detalle({ status: "paused" }))).toEqual({ publish: true, pause: false, close: true, remove: false });
    expect(offerActions(detalle({ status: "closed" }))).toEqual({ publish: false, pause: false, close: false, remove: false });
    expect(offerActions(detalle({ status: "draft", applications_count: 2 })).remove).toBe(false);
  });
});

describe("formulario de oferta: ida y vuelta con OfferInput", () => {
  it("fromOfferDetail -> toOfferInput devuelve el mismo OfferInput", () => {
    const d = detalle({ languages: [{ language_id: IDIOMA, min_proficiency: "basic" }], driver_license_ids: [LICENCIA] });
    const entrada = toOfferInput(fromOfferDetail(d));
    for (const k of ["id", "status", "required_driver_license", "publication_date", "closed_at", "created_at", "updated_at", "applications_count", "created_by"]) expect(entrada, k).not.toHaveProperty(k);
    expect(entrada).toMatchObject({ title: "Desarrollador backend", required_experience: 2, vacancies: 2, job_hierarchy_id: null, skills: [{ skill_id: SKILL, is_required: true, min_level: "intermediate" }], driver_license_ids: [LICENCIA] });
  });
  it("toOfferInput: textos recortados, vacíos como null, números como números; sin experiencia exigida no hay años", () => {
    const f = { ...emptyOfferForm(), title: "  Analista  ", vacancies: "3", is_experience_required: false, required_experience: "4", skills: [{ skill_id: SKILL, is_required: false, min_level: "" }] };
    expect(toOfferInput(f)).toMatchObject({ title: "Analista", description: null, vacancies: 3, required_experience: null, is_experience_required: false, schedule: null, skills: [{ skill_id: SKILL, is_required: false, min_level: null }] });
  });
  it("validateOffer: título 3–120; descripción vacía o 20–5000; años 0–50 si se exigen; vacantes 1–999; fecha de hoy a dos años; sin repetidos", () => {
    const base = { ...emptyOfferForm(), title: "Analista de datos" };
    expect(validateOffer(base, HOY)).toEqual({});
    expect(validateOffer({ ...base, title: "AB" }, HOY)).toEqual({ title: "offerForm.error.title" });
    expect(validateOffer({ ...base, description: "corta" }, HOY)).toEqual({ description: "offerForm.error.description" });
    expect(validateOffer({ ...base, is_experience_required: true, required_experience: "" }, HOY)).toEqual({ required_experience: "offerForm.error.experience" });
    expect(validateOffer({ ...base, is_experience_required: true, required_experience: "51" }, HOY)).toEqual({ required_experience: "offerForm.error.experience" });
    expect(validateOffer({ ...base, vacancies: "0" }, HOY)).toEqual({ vacancies: "offerForm.error.vacancies" });
    expect(validateOffer({ ...base, hiring_date: "2026-11-09" }, HOY)).toEqual({ hiring_date: "offerForm.error.hiringDate" });
    expect(validateOffer({ ...base, hiring_date: "2028-11-11" }, HOY)).toEqual({ hiring_date: "offerForm.error.hiringDate" });
    expect(validateOffer({ ...base, hiring_date: "2028-11-10" }, HOY)).toEqual({});
    expect(validateOffer({ ...base, skills: [{ skill_id: SKILL, is_required: true, min_level: "" }, { skill_id: SKILL, is_required: false, min_level: "" }] }, HOY)).toEqual({ skills: "offerForm.error.skills" });
  });
});

describe("formulario de empresa y membresía", () => {
  const bueno = { name: "Café Nuevo S.A.", tax_id: "1234567-8", website: "https://cafenuevo.example", phone: "", description: "", country_id: "p", employment_sector_id: "s" };
  it("validateCompany: los límites de CompanyInput", () => {
    expect(validateCompany(bueno)).toEqual({});
    expect(validateCompany({ ...bueno, name: "A" })).toEqual({ name: "companyForm.error.name" });
    expect(validateCompany({ ...bueno, tax_id: "12#4" })).toEqual({ tax_id: "companyForm.error.taxId" });
    expect(validateCompany({ ...bueno, website: "http://cafenuevo.example" })).toEqual({ website: "companyForm.error.website" });
    expect(validateCompany({ ...bueno, website: "" })).toEqual({});
    expect(validateCompany({ ...bueno, phone: "1".repeat(21) })).toEqual({ phone: "companyForm.error.phone" });
    expect(validateCompany({ ...bueno, country_id: "" })).toEqual({ country_id: "companyForm.error.country" });
    expect(validateCompany({ ...bueno, employment_sector_id: "" })).toEqual({ employment_sector_id: "companyForm.error.sector" });
  });
  it("validateMembership: el fin no antes del inicio y a lo sumo 400 días después", () => {
    expect(validateMembership("2026-11-01", "2027-11-01")).toBeNull();
    expect(validateMembership("2026-11-01", "2026-10-31")).toBe("admin.membership.error");
    expect(validateMembership("2026-11-01", "2027-12-07")).toBe("admin.membership.error");
    expect(validateMembership("2026-11-01", "2027-12-06")).toBeNull();
    expect(validateMembership("", "2027-11-01")).toBe("admin.membership.error");
  });
});

describe("companyApi y adminApi: una función por endpoint", () => {
  const ENTRADA = toOfferInput(fromOfferDetail(detalle()));
  const casos: [string, () => Promise<unknown>, string, string, unknown][] = [
    ["get", () => companyApi.get(), "GET", "/api/company", undefined],
    ["create", () => companyApi.create({ name: "x" } as never), "POST", "/api/company", { name: "x" }],
    ["update", () => companyApi.update({ name: "x" } as never), "PUT", "/api/company", { name: "x" }],
    ["recruiters", () => companyApi.recruiters(), "GET", "/api/company/recruiters", undefined],
    ["removeRecruiter", () => companyApi.removeRecruiter(REC), "DELETE", `/api/company/recruiters/${REC}`, undefined],
    ["invitations", () => companyApi.invitations(), "GET", "/api/company/invitations", undefined],
    ["invite", () => companyApi.invite("luis@example.test", "recruiter"), "POST", "/api/company/invitations", { email: "luis@example.test", role: "recruiter" }],
    ["revokeInvitation", () => companyApi.revokeInvitation(INV), "DELETE", `/api/company/invitations/${INV}`, undefined],
    ["acceptInvitation", () => companyApi.acceptInvitation(TOKEN), "POST", "/api/invitations/accept", { token: TOKEN }],
    ["offers", () => companyApi.offers({ status: "draft" }), "GET", "/api/company/offers?status=draft", undefined],
    ["offer", () => companyApi.offer(OFF), "GET", `/api/company/offers/${OFF}`, undefined],
    ["createOffer", () => companyApi.createOffer(ENTRADA), "POST", "/api/company/offers", ENTRADA],
    ["updateOffer", () => companyApi.updateOffer(OFF, ENTRADA), "PUT", `/api/company/offers/${OFF}`, ENTRADA],
    ["deleteOffer", () => companyApi.deleteOffer(OFF), "DELETE", `/api/company/offers/${OFF}`, undefined],
    ["publishOffer", () => companyApi.publishOffer(OFF), "POST", `/api/company/offers/${OFF}/publish`, undefined],
    ["pauseOffer", () => companyApi.pauseOffer(OFF), "POST", `/api/company/offers/${OFF}/pause`, undefined],
    ["closeOffer", () => companyApi.closeOffer(OFF), "POST", `/api/company/offers/${OFF}/close`, undefined],
    ["panel", () => companyApi.panel(OFF, {}), "GET", `/api/company/offers/${OFF}/applications`, undefined],
    ["panelApplication", () => companyApi.panelApplication(PAP), "GET", `/api/company/applications/${PAP}`, undefined],
    ["move", () => companyApi.move(PAP, "under_review", "  "), "POST", `/api/company/applications/${PAP}/status`, { to: "under_review" }],
    ["moveWithNote", () => companyApi.move(PAP, "rejected", " Sin Rust "), "POST", `/api/company/applications/${PAP}/status`, { to: "rejected", note: "Sin Rust" }],
    ["favorite on", () => companyApi.setFavorite(PAP, true), "PUT", `/api/company/applications/${PAP}/favorite`, undefined],
    ["favorite off", () => companyApi.setFavorite(PAP, false), "DELETE", `/api/company/applications/${PAP}/favorite`, undefined],
    ["admin list", () => adminApi.companies({ verified: false }), "GET", "/api/admin/companies?verified=false", undefined],
    ["verify", () => adminApi.verify(CID), "POST", `/api/admin/companies/${CID}/verify`, undefined],
    ["unverify", () => adminApi.unverify(CID), "POST", `/api/admin/companies/${CID}/unverify`, undefined],
    ["membership", () => adminApi.setMembership(CID, "2026-11-01", "2027-11-01"), "PUT", `/api/admin/companies/${CID}/membership`, { membership_type: "business", start_date: "2026-11-01", expiration_date: "2027-11-01" }],
  ];
  for (const [nombre, llamar, method, url, body] of casos) {
    it(`${nombre} -> ${method} ${url}`, async () => {
      const { llamadas } = stubFetch(() => jsonRes(200, {}));
      await llamar();
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toMatchObject({ url, method });
      expect(llamadas[0].body).toEqual(body);
    });
  }
  it("panelQuery: solo status, favorite, sort, limit y cursor; «recent» no hace falta mandarlo", () => {
    expect(panelQuery({})).toBe("");
    expect(panelQuery({ status: "shortlisted", favorite: true, sort: "oldest", limit: 20, cursor: "a+b" })).toBe("?limit=20&cursor=a%2Bb&status=shortlisted&favorite=true&sort=oldest");
    expect(panelQuery({ sort: "recent", favorite: false })).toBe("?favorite=false");
    expect(panelQuery({ name: "Ana" } as never)).toBe("");
  });
  it("recoge `fields` de un 422 oferta_incompleta y el estado vigente de un 409", async () => {
    stubFetch(() => jsonRes(422, { error: "oferta_incompleta", fields: ["description", "requirements"] }));
    expect(await companyApi.publishOffer(OFF)).toMatchObject({ status: 422, error: "oferta_incompleta", fields: ["description", "requirements"] });
    stubFetch(() => jsonRes(409, { error: "estado_invalido", status: "rejected" }));
    expect(await companyApi.move(PAP, "hired")).toMatchObject({ status: 409, currentStatus: "rejected" });
  });
});

describe("FC7/FC8: errores del lado empresa en español, sin texto técnico", () => {
  const casos: [number, string | null, string][] = [
    [403, "empresa_no_verificada", "company.error.unverified"],
    [403, "membresia_vencida", "company.error.expired"],
    [403, "sin_permiso", "company.error.noPermission"],
    [404, "no_encontrado", "company.error.notFound"],
    [404, "invitacion_invalida", "company.error.invitation"],
    [409, "ya_tiene_empresa", "company.error.alreadyMember"],
    [409, "empresa_duplicada", "company.error.duplicate"],
    [409, "nit_inmutable", "company.error.taxIdLocked"],
    [409, "ultimo_administrador", "company.error.lastAdmin"],
    [409, "oferta_con_aplicaciones", "company.error.offerFrozen"],
    [409, "confidencial_inmutable", "company.error.confidentialLocked"],
    [409, "estado_invalido", "company.error.state"],
    [422, "oferta_incompleta", "company.error.incomplete"],
    [422, "datos_invalidos", "offers.error.invalid"],
    [429, "demasiados_intentos", "company.error.rateLimited"],
    [0, null, "offers.error.generic"],
    [502, null, "offers.error.generic"],
  ];
  for (const [estado, codigo, clave] of casos) {
    it(`${estado} ${codigo ?? "(sin código)"} -> ${clave}`, () => expect(companyErrorKey(estado, codigo)).toBe(clave));
  }
  it("un 429 con Retry-After dice cuánto esperar", () => {
    expect(companyErrorText({ status: 429, error: "demasiados_intentos", retryAfter: 120 })).toBe(tf("company.error.rateLimitedIn", { wait: tf("offers.wait.minutes", { n: 2 }) }));
    expect(companyErrorText({ status: 409, error: "nit_inmutable" })).toBe(t("company.error.taxIdLocked"));
  });
  it("ningún mensaje de error muestra códigos, estados HTTP ni jerga técnica", () => {
    const tecnico = /\b(40[0-9]|42[0-9]|50[0-9]|http|json|api|null|undefined|status|uuid|id)\b|_/i;
    for (const [k, v] of Object.entries(es)) {
      if (/^(company|panel|admin|offerForm|companyForm|companyOffers)\.(error|.*\.error)/.test(k) || /^(company|panel|admin|offerForm|companyForm|companyOffers)\..*(failed|loadError|moreError)$/.test(k)) expect(v, k).not.toMatch(tecnico);
    }
  });
});
