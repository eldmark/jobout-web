// @vitest-environment node
/**
 * Capa servidor de ofertas, aplicaciones y registros externos (Fase 5a, paso 11). Reenvía a core-api
 * con el token de las cookies; valida antes de tocar el backend; de los errores solo pasan los códigos
 * del contrato y los ecos validados (`application_id`, `status`, `Retry-After` entero).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { AID, APLICACION, APLICACION_DETALLE, DETALLE, EID, EXTERNA, OFERTA, OID, PROF, ST_GT, paginaOfertas } from "./helpers/offers";
import * as offers from "@/app/api/offers/route";
import * as offer from "@/app/api/offers/[id]/route";
import * as apply from "@/app/api/offers/[id]/applications/route";
import * as applications from "@/app/api/applications/route";
import * as application from "@/app/api/applications/[id]/route";
import * as withdraw from "@/app/api/applications/[id]/withdraw/route";
import * as externals from "@/app/api/applications/external/route";
import * as external from "@/app/api/applications/external/[id]/route";
import * as catalogs from "@/app/api/catalogs/[nombre]/route";

const API = "http://core-api:8080/api/v1";
const COOKIE = "jo_session=acc-111; jo_refresh=ref-222";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rq = (url: string, method = "GET", body?: unknown, cookie: string | null = COOKIE) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const MINIMO = ["display_name", "skills", "experience"];

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/offers", () => {
  it("reenvía con Bearer a /offers y devuelve el JSON sin cache", async () => {
    const cuerpo = paginaOfertas([OFERTA()], "sig");
    const { llamadas } = stubFetch(() => jsonRes(200, cuerpo));
    const res = await offers.GET(rq("/api/offers"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cuerpo);
    expect(llamadas[0].url).toBe(`${API}/offers`);
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("reenvía limit, cursor, sort y los ocho filtros (ids de catálogo)", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, paginaOfertas([])));
    const filtros = ["profession_id", "state_id", "city_id", "contract_type_id", "salary_range_id", "working_shift_id", "employment_sector_id", "job_hierarchy_id"];
    const q = new URLSearchParams({ limit: "20", cursor: "cj_-x", sort: "oldest" });
    for (const f of filtros) q.set(f, PROF);
    await offers.GET(rq(`/api/offers?${q}`));
    const u = new URL(llamadas[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(`${API}/offers`);
    expect(Object.fromEntries(u.searchParams)).toEqual(Object.fromEntries(q));
  });
  it("no discriminación: lo que no es del contrato no se reenvía nunca (edad, género, nombre, empresa, texto)", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, paginaOfertas([])));
    await offers.GET(rq(`/api/offers?state_id=${ST_GT}&age=30&gender=f&marital_status=x&name=Ana&photo=1&q=banco&company_id=${PROF}&sort=recent`));
    const u = new URL(llamadas[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(`${API}/offers`);
    expect([...u.searchParams.keys()].sort()).toEqual(["sort", "state_id"]);
    expect(Object.fromEntries(u.searchParams)).toEqual({ state_id: ST_GT, sort: "recent" });
  });
  for (const q of ["limit=0", "limit=51", "limit=abc", "sort=match", "sort=name", "sort=", "cursor=", `cursor=${"a".repeat(600)}`, "cursor=%3Cscript%3E", "profession_id=1", "city_id=no-es-uuid", `state_id=${ST_GT}&state_id=${PROF}`]) {
    it(`${q.slice(0, 40)} -> 422 datos_invalidos sin tocar el backend`, async () => {
      const { fn } = stubFetch(() => jsonRes(200, paginaOfertas([])));
      const res = await offers.GET(rq(`/api/offers?${q}`));
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "datos_invalidos" });
      expect(fn).not.toHaveBeenCalled();
    });
  }
  it("422 parametro_no_permitido del backend se conserva", async () => {
    stubFetch(() => jsonRes(422, { error: "parametro_no_permitido", message: "texto" }));
    const res = await offers.GET(rq("/api/offers"));
    expect([res.status, await res.json()]).toEqual([422, { error: "parametro_no_permitido" }]);
  });
});

describe("GET /api/offers/{id}", () => {
  it("reenvía; id mal formado -> 404 sin backend; 404 del backend se conserva", async () => {
    const { llamadas, fn } = stubFetch(() => jsonRes(200, DETALLE()));
    const ok = await offer.GET(rq(`/api/offers/${OID}`), ctx(OID));
    expect(ok.status).toBe(200);
    expect(llamadas[0].url).toBe(`${API}/offers/${OID}`);
    fn.mockClear();
    expect((await offer.GET(rq("/api/offers/zzz"), ctx("zzz"))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
    stubFetch(() => jsonRes(404, { error: "no_encontrado", message: "No encontramos lo que buscas." }));
    const no = await offer.GET(rq(`/api/offers/${OID}`), ctx(OID));
    expect([no.status, await no.json()]).toEqual([404, { error: "no_encontrado" }]);
  });
});

describe("POST /api/offers/{id}/applications (AP1, AP2)", () => {
  const aplicar = (body: unknown, id = OID) => apply.POST(rq(`/api/offers/${id}/applications`, "POST", body), ctx(id));

  it("reenvía exactamente {consent: true, shared_fields} y devuelve 201", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, APLICACION_DETALLE()));
    const res = await aplicar({ consent: true, shared_fields: [...MINIMO, "email"], applicant_id: "x", consented_at: "2020-01-01T00:00:00Z" });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(AID);
    expect(llamadas[0]).toMatchObject({ url: `${API}/offers/${OID}/applications`, method: "POST" });
    expect(llamadas[0].body).toEqual({ consent: true, shared_fields: [...MINIMO, "email"] });
  });
  for (const consent of [undefined, false, null, "true", 1, "si"]) {
    it(`AP2: consent = ${JSON.stringify(consent)} -> 422 consentimiento_requerido y el backend no se toca`, async () => {
      const { fn } = stubFetch(() => jsonRes(201, APLICACION_DETALLE()));
      const res = await aplicar(consent === undefined ? { shared_fields: MINIMO } : { consent, shared_fields: MINIMO });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "consentimiento_requerido" });
      expect(fn).not.toHaveBeenCalled();
    });
  }
  const malos: [string, unknown][] = [
    ["sin lista", undefined],
    ["no es lista", "display_name"],
    ["sin los obligatorios", ["display_name", "skills"]],
    ["un nombre fuera del conjunto", [...MINIMO, "address"]],
    ["un nombre de la 5b", [...MINIMO, "match_score"]],
    ["repetido", [...MINIMO, "email", "email"]],
    ["no son cadenas", [...MINIMO, 5]],
  ];
  for (const [nombre, shared_fields] of malos) {
    it(`shared_fields ${nombre} -> 422 datos_invalidos sin backend`, async () => {
      const { fn } = stubFetch(() => jsonRes(201, APLICACION_DETALLE()));
      const res = await aplicar(shared_fields === undefined ? { consent: true } : { consent: true, shared_fields });
      expect([res.status, await res.json()]).toEqual([422, { error: "datos_invalidos" }]);
      expect(fn).not.toHaveBeenCalled();
    });
  }
  it("cuerpo que no es un objeto -> 422 sin backend; id de oferta mal formado -> 404 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, {}));
    expect((await aplicar([true])).status).toBe(422);
    expect((await aplicar({ consent: true, shared_fields: MINIMO }, "nope")).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("409 ya_aplicaste conserva application_id solo si es un UUID", async () => {
    stubFetch(() => jsonRes(409, { error: "ya_aplicaste", message: "Ya aplicaste.", application_id: AID }));
    const r1 = await aplicar({ consent: true, shared_fields: MINIMO });
    expect([r1.status, await r1.json()]).toEqual([409, { error: "ya_aplicaste", application_id: AID }]);
    stubFetch(() => jsonRes(409, { error: "ya_aplicaste", application_id: "<script>" }));
    expect(await (await aplicar({ consent: true, shared_fields: MINIMO })).json()).toEqual({ error: "ya_aplicaste" });
  });
  const errores: [number, string][] = [
    [404, "no_encontrado"],
    [409, "oferta_propia"],
    [422, "consentimiento_requerido"],
    [422, "datos_invalidos"],
    [422, "campo_no_permitido"],
    [403, "cuenta_no_disponible"],
  ];
  for (const [estado, codigo] of errores) {
    it(`${estado} ${codigo} se reenvía con su código y sin el texto del backend`, async () => {
      stubFetch(() => jsonRes(estado, { error: codigo, message: "Café Nuevo S.A. no recibe más" }));
      const res = await aplicar({ consent: true, shared_fields: MINIMO });
      expect(res.status).toBe(estado);
      const texto = await res.text();
      expect(JSON.parse(texto)).toEqual({ error: codigo });
      expect(texto).not.toContain("Café");
    });
  }
  it("429 demasiados_intentos reenvía Retry-After solo si son segundos enteros", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "3600", "x-interno": "1" } }));
    const res = await aplicar({ consent: true, shared_fields: MINIMO });
    expect([res.status, res.headers.get("retry-after"), res.headers.get("x-interno")]).toEqual([429, "3600", null]);
    stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "mañana" } }));
    expect((await aplicar({ consent: true, shared_fields: MINIMO })).headers.get("retry-after")).toBeNull();
  });
  it("un código desconocido o un detalle técnico NO se reenvía: 502 genérico", async () => {
    stubFetch(() => jsonRes(409, { error: "SELECT * FROM job_applications", detail: "stack" }));
    const res = await aplicar({ consent: true, shared_fields: MINIMO });
    expect(res.status).toBe(502);
    expect(await res.text()).toBe(JSON.stringify({ error: "servicio_no_disponible" }));
  });
});

describe("mis aplicaciones: listar, leer y retirar (AP7, AP8)", () => {
  it("GET /api/applications -> /me/applications con limit, cursor y status validados", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, paginaOfertas([APLICACION()])));
    const res = await applications.GET(rq("/api/applications?limit=5&cursor=abc_-&status=withdrawn&applicant_id=1"));
    expect(res.status).toBe(200);
    const u = new URL(llamadas[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(`${API}/me/applications`);
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: "5", cursor: "abc_-", status: "withdrawn" });
  });
  it("acepta los seis estados de la máquina; otro -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(200, paginaOfertas([])));
    for (const s of ["applied", "under_review", "shortlisted", "rejected", "withdrawn", "hired"]) {
      expect((await applications.GET(rq(`/api/applications?status=${s}`))).status).toBe(200);
    }
    expect(fn).toHaveBeenCalledTimes(6);
    fn.mockClear();
    for (const q of ["status=archivada", "status=", "limit=99"]) expect((await applications.GET(rq(`/api/applications?${q}`))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("GET /api/applications/{id} -> /me/applications/{id}; mal formado -> 404 sin backend", async () => {
    const { llamadas, fn } = stubFetch(() => jsonRes(200, APLICACION_DETALLE()));
    expect((await application.GET(rq(`/api/applications/${AID}`), ctx(AID))).status).toBe(200);
    expect(llamadas[0].url).toBe(`${API}/me/applications/${AID}`);
    fn.mockClear();
    expect((await application.GET(rq("/api/applications/1"), ctx("1"))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("POST withdraw -> 204 hacia /me/applications/{id}/withdraw", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await withdraw.POST(rq(`/api/applications/${AID}/withdraw`, "POST"), ctx(AID));
    expect(res.status).toBe(204);
    expect(llamadas[0]).toMatchObject({ method: "POST", url: `${API}/me/applications/${AID}/withdraw` });
  });
  it("409 estado_invalido conserva el estado vigente solo si es uno de la máquina", async () => {
    stubFetch(() => jsonRes(409, { error: "estado_invalido", message: "x", status: "rejected" }));
    const r = await withdraw.POST(rq(`/api/applications/${AID}/withdraw`, "POST"), ctx(AID));
    expect([r.status, await r.json()]).toEqual([409, { error: "estado_invalido", status: "rejected" }]);
    stubFetch(() => jsonRes(409, { error: "estado_invalido", status: "<b>x</b>" }));
    expect(await (await withdraw.POST(rq(`/api/applications/${AID}/withdraw`, "POST"), ctx(AID))).json()).toEqual({ error: "estado_invalido" });
  });
  it("withdraw: 404 se conserva; id mal formado -> 404 sin backend", async () => {
    stubFetch(() => jsonRes(404, { error: "no_encontrado" }));
    expect((await withdraw.POST(rq(`/api/applications/${AID}/withdraw`, "POST"), ctx(AID))).status).toBe(404);
    const { fn } = stubFetch(() => jsonRes(204));
    expect((await withdraw.POST(rq("/x", "POST"), ctx("x"))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("registro de aplicaciones externas (HU-32)", () => {
  const BUENA = { company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "interviewing", notes: "Hablé con RRHH." };

  it("GET lista -> /me/external-applications con limit, cursor y status validados", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, paginaOfertas([EXTERNA()])));
    expect((await externals.GET(rq("/api/applications/external?status=offer&limit=10&x=1"))).status).toBe(200);
    expect(llamadas[0].url).toBe(`${API}/me/external-applications?limit=10&status=offer`);
    const { fn } = stubFetch(() => jsonRes(200, paginaOfertas([])));
    expect((await externals.GET(rq("/api/applications/external?status=hired"))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("POST reenvía solo los cinco campos del contrato y devuelve 201", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, EXTERNA()));
    const res = await externals.POST(rq("/api/applications/external", "POST", { ...BUENA, applicant_id: "x", id: "y" }));
    expect(res.status).toBe(201);
    expect(llamadas[0]).toMatchObject({ url: `${API}/me/external-applications`, method: "POST" });
    expect(llamadas[0].body).toEqual(BUENA);
  });
  it("notes es opcional: null o ausente viaja como null", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, EXTERNA({ notes: null })));
    const sinNotas = { ...BUENA } as Record<string, unknown>;
    delete sinNotas.notes;
    await externals.POST(rq("/api/applications/external", "POST", sinNotas));
    expect(llamadas[0].body).toEqual({ ...BUENA, notes: null });
  });
  const malas: [string, Record<string, unknown>][] = [
    ["empresa no es texto", { company_name: 5 }],
    ["puesto ausente", { position: undefined }],
    ["fecha sin formato", { applied_on: "05/11/2026" }],
    ["estado fuera del conjunto", { status: "hired" }],
    ["notas no son texto", { notes: 12 }],
  ];
  for (const [nombre, cambio] of malas) {
    it(`${nombre} -> 422 datos_invalidos sin backend`, async () => {
      const { fn } = stubFetch(() => jsonRes(201, EXTERNA()));
      const res = await externals.POST(rq("/api/applications/external", "POST", { ...BUENA, ...cambio }));
      expect([res.status, await res.json()]).toEqual([422, { error: "datos_invalidos" }]);
      expect(fn).not.toHaveBeenCalled();
    });
  }
  it("409 limite_de_registros y 422 datos_invalidos del backend se conservan", async () => {
    stubFetch(() => jsonRes(409, { error: "limite_de_registros", message: "x" }));
    const r = await externals.POST(rq("/api/applications/external", "POST", BUENA));
    expect([r.status, await r.json()]).toEqual([409, { error: "limite_de_registros" }]);
    stubFetch(() => jsonRes(422, { error: "datos_invalidos", message: "La fecha debe ser de hoy a cinco años atrás." }));
    const r2 = await externals.POST(rq("/api/applications/external", "POST", BUENA));
    expect([r2.status, await r2.json()]).toEqual([422, { error: "datos_invalidos" }]);
  });
  it("GET, PUT (reemplazo completo) y DELETE de uno; id mal formado -> 404 sin backend", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, EXTERNA()) : jsonRes(204)));
    expect((await external.GET(rq(`/api/applications/external/${EID}`), ctx(EID))).status).toBe(200);
    expect((await external.PUT(rq(`/api/applications/external/${EID}`, "PUT", { ...BUENA, status: "offer" }), ctx(EID))).status).toBe(204);
    expect((await external.DELETE(rq(`/api/applications/external/${EID}`, "DELETE"), ctx(EID))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, c.url])).toEqual([
      ["GET", `${API}/me/external-applications/${EID}`],
      ["PUT", `${API}/me/external-applications/${EID}`],
      ["DELETE", `${API}/me/external-applications/${EID}`],
    ]);
    expect(llamadas[1].body).toEqual({ ...BUENA, status: "offer" });
    const { fn } = stubFetch(() => jsonRes(204));
    for (const h of [external.GET, external.DELETE]) expect((await h(rq("/x"), ctx("x"))).status).toBe(404);
    expect((await external.PUT(rq("/x", "PUT", BUENA), ctx("x"))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("catálogos de los filtros", () => {
  const cat = (nombre: string, query = "") => catalogs.GET(rq(`/api/catalogs/${nombre}${query}`), { params: Promise.resolve({ nombre }) });
  it("sirve los catálogos que usan los filtros de ofertas", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, []));
    for (const n of ["states", "cities", "contract-types", "salary-ranges", "working-shifts", "employment-sectors", "professions", "job-hierarchies"]) {
      expect((await cat(n)).status, n).toBe(200);
    }
    expect(llamadas.map((c) => c.url.replace(`${API}/catalogs/`, ""))).toEqual(["states", "cities", "contract-types", "salary-ranges", "working-shifts", "employment-sectors", "professions", "job-hierarchies"]);
  });
  it("cities reenvía state_id si es un UUID; si no, 422 sin backend; otros parámetros no viajan", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, []));
    await cat("cities", `?state_id=${ST_GT}&x=1`);
    expect(llamadas[0].url).toBe(`${API}/catalogs/cities?state_id=${ST_GT}`);
    await cat("states", `?state_id=${ST_GT}`);
    expect(llamadas[1].url).toBe(`${API}/catalogs/states`);
    const { fn } = stubFetch(() => jsonRes(200, []));
    expect((await cat("cities", "?state_id=guatemala")).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("zones y membership-types siguen sin servirse", async () => {
    const { fn } = stubFetch(() => jsonRes(200, []));
    for (const n of ["zones", "membership-types", "countries"]) expect((await cat(n)).status, n).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("sin sesión: 401 JSON y el backend no se toca", () => {
  it("todas las rutas nuevas responden 401", async () => {
    const { fn } = stubFetch(() => jsonRes(200, {}));
    const sin = (url: string, method = "GET", body?: unknown) => rq(url, method, body, null);
    const rs = await Promise.all([
      offers.GET(sin("/api/offers")),
      offer.GET(sin("/x"), ctx(OID)),
      apply.POST(sin("/x", "POST", { consent: true, shared_fields: MINIMO }), ctx(OID)),
      applications.GET(sin("/api/applications")),
      application.GET(sin("/x"), ctx(AID)),
      withdraw.POST(sin("/x", "POST"), ctx(AID)),
      externals.GET(sin("/api/applications/external")),
      externals.POST(sin("/x", "POST", { company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "applied" })),
      external.GET(sin("/x"), ctx(EID)),
      external.PUT(sin("/x", "PUT", { company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "applied" }), ctx(EID)),
      external.DELETE(sin("/x", "DELETE"), ctx(EID)),
    ]);
    for (const r of rs) expect(r.status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
});
