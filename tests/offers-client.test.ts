/** Cliente del navegador para ofertas y aplicaciones + errores en español (FC7). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { AID, EID, EXTERNA, OFERTA, OID, PROF, ST_GT, paginaOfertas } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { es } from "@/lib/messages/es";
import { goTo } from "@/lib/navigate";
import { offersApi, offerQuery } from "@/lib/offers/client";
import { offerErrorKey, offerErrorText } from "@/lib/offers/errors";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const MINIMO = ["display_name", "skills", "experience"] as const;
const ENTRADA = { company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "applied" as const, notes: null };

describe("offersApi: una función por endpoint", () => {
  const casos: [string, () => Promise<unknown>, string, string, unknown][] = [
    ["list", () => offersApi.list(), "GET", "/api/offers", undefined],
    ["get", () => offersApi.get(OID), "GET", `/api/offers/${OID}`, undefined],
    ["apply", () => offersApi.apply(OID, { consent: true, shared_fields: [...MINIMO] }), "POST", `/api/offers/${OID}/applications`, { consent: true, shared_fields: [...MINIMO] }],
    ["applications", () => offersApi.applications(), "GET", "/api/applications", undefined],
    ["application", () => offersApi.application(AID), "GET", `/api/applications/${AID}`, undefined],
    ["withdraw", () => offersApi.withdraw(AID), "POST", `/api/applications/${AID}/withdraw`, undefined],
    ["externals", () => offersApi.externals(), "GET", "/api/applications/external", undefined],
    ["createExternal", () => offersApi.createExternal(ENTRADA), "POST", "/api/applications/external", ENTRADA],
    ["updateExternal", () => offersApi.updateExternal(EID, ENTRADA), "PUT", `/api/applications/external/${EID}`, ENTRADA],
    ["removeExternal", () => offersApi.removeExternal(EID), "DELETE", `/api/applications/external/${EID}`, undefined],
    ["catalog", () => offersApi.catalog("states"), "GET", "/api/catalogs/states", undefined],
    ["cities", () => offersApi.catalog("cities", ST_GT), "GET", `/api/catalogs/cities?state_id=${ST_GT}`, undefined],
    ["profile", () => offersApi.profile(), "GET", "/api/profile", undefined],
  ];
  for (const [nombre, llamar, method, url, body] of casos) {
    it(`${nombre} -> ${method} ${url}`, async () => {
      const { llamadas } = stubFetch(() => jsonRes(200, {}));
      const r = (await llamar()) as { status: number };
      expect(r.status).toBe(200);
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toMatchObject({ url, method });
      expect(llamadas[0].body).toEqual(body);
    });
  }
  it("devuelve data tipada en éxito; 204 -> data null sin error", async () => {
    stubFetch(() => jsonRes(200, paginaOfertas([OFERTA()])));
    expect((await offersApi.list()).data?.items[0].title).toBe("Desarrollador backend");
    stubFetch(() => jsonRes(204));
    expect(await offersApi.withdraw(AID)).toMatchObject({ status: 204, data: null, error: null });
  });
  it("conserva application_id de un 409 ya_aplicaste y el estado vigente de un 409 estado_invalido", async () => {
    stubFetch(() => jsonRes(409, { error: "ya_aplicaste", application_id: AID }));
    expect(await offersApi.apply(OID, { consent: true, shared_fields: [...MINIMO] })).toMatchObject({ status: 409, error: "ya_aplicaste", applicationId: AID });
    stubFetch(() => jsonRes(409, { error: "estado_invalido", status: "hired" }));
    expect(await offersApi.withdraw(AID)).toMatchObject({ status: 409, error: "estado_invalido", currentStatus: "hired" });
  });
  it("lee Retry-After (segundos) de un 429; si no es un número lo ignora", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "120" } }));
    expect(await offersApi.apply(OID, { consent: true, shared_fields: [...MINIMO] })).toMatchObject({ status: 429, retryAfter: 120 });
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "pronto" } }));
    expect((await offersApi.apply(OID, { consent: true, shared_fields: [...MINIMO] })).retryAfter).toBeNull();
  });
  it("un fallo de red es status 0; un 401 lleva a /sign-in", async () => {
    stubFetch(() => {
      throw new Error("offline");
    });
    expect(await offersApi.get(OID)).toMatchObject({ status: 0, data: null });
    stubFetch(() => jsonRes(401, { error: "sesion_expirada" }));
    await offersApi.applications();
    expect(goTo).toHaveBeenCalledWith("/sign-in");
  });
  it("listados con limit, cursor y status codificados", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, paginaOfertas([EXTERNA()])));
    await offersApi.applications({ limit: 20, cursor: "a+b/c=", status: "withdrawn" });
    await offersApi.externals({ cursor: "z", status: "offer" });
    expect(llamadas.map((c) => c.url)).toEqual(["/api/applications?limit=20&cursor=a%2Bb%2Fc%3D&status=withdrawn", "/api/applications/external?cursor=z&status=offer"]);
  });
});

describe("offerQuery: la consulta del listado", () => {
  it("vacía si no hay nada", () => {
    expect(offerQuery({})).toBe("");
  });
  it("limit, cursor, sort y solo los filtros con valor, en el orden del contrato", () => {
    expect(offerQuery({ limit: 20, cursor: "a+b", sort: "oldest", filters: { city_id: "", state_id: ST_GT, profession_id: PROF } })).toBe(
      `?limit=20&cursor=a%2Bb&sort=oldest&profession_id=${PROF}&state_id=${ST_GT}`,
    );
  });
  it("«recent» es el orden por defecto y no hace falta mandarlo", () => {
    expect(offerQuery({ sort: "recent" })).toBe("");
  });
  it("nunca agrega un parámetro fuera del contrato", () => {
    const q = offerQuery({ filters: { state_id: ST_GT, age: "30", company_id: "x" } as never });
    expect(q).toBe(`?state_id=${ST_GT}`);
  });
});

describe("FC7: errores en español, sin texto técnico", () => {
  const casos: [number, string | null, string][] = [
    [422, "consentimiento_requerido", "offers.error.consent"],
    [409, "ya_aplicaste", "offers.error.alreadyApplied"],
    [409, "oferta_propia", "offers.error.ownOffer"],
    [409, "estado_invalido", "offers.error.state"],
    [409, "limite_de_registros", "offers.error.externalLimit"],
    [422, "datos_invalidos", "offers.error.invalid"],
    [422, "campo_no_permitido", "offers.error.invalid"],
    [422, "parametro_no_permitido", "offers.error.invalid"],
    [422, null, "offers.error.invalid"],
    [429, "demasiados_intentos", "offers.error.rateLimited"],
    [403, "cuenta_no_disponible", "offers.error.forbidden"],
    [404, "no_encontrado", "offers.error.notFound"],
    [404, null, "offers.error.notFound"],
    [0, null, "offers.error.generic"],
    [502, "servicio_no_disponible", "offers.error.generic"],
    [500, null, "offers.error.generic"],
  ];
  for (const [estado, codigo, clave] of casos) {
    it(`${estado} ${codigo ?? "(sin código)"} -> ${clave}`, () => {
      expect(offerErrorKey(estado, codigo)).toBe(clave);
    });
  }
  it("demasiados_intentos con Retry-After dice cuánto esperar", () => {
    expect(offerErrorText({ status: 429, error: "demasiados_intentos", retryAfter: 7200 })).toBe(tf("offers.error.rateLimitedIn", { wait: tf("offers.wait.hours", { n: 2 }) }));
    expect(offerErrorText({ status: 429, error: "demasiados_intentos", retryAfter: null })).toBe(t("offers.error.rateLimited"));
  });
  it("ningún mensaje de error ni de estado muestra códigos, estados HTTP ni jerga técnica", () => {
    const tecnico = /\b(40[0-9]|42[0-9]|50[0-9]|http|json|api|null|undefined|status|uuid|id)\b|_/i;
    for (const [k, v] of Object.entries(es)) {
      if (/^(offers?|apply|applications|external)\.(error|wait|status)/.test(k) || /\.(error|failed|loadError|moreError)$/.test(k) && /^(offers?|apply|applications|external)\./.test(k)) {
        expect(v, k).not.toMatch(tecnico);
      }
    }
  });
});
