// @vitest-environment node
/**
 * Capa servidor del lado empresa (Fase 5a, paso 12): empresa, reclutadores, invitaciones, ofertas del
 * reclutador, panel y administración. Reenvía con el token de las cookies; valida antes de tocar el
 * backend; de los errores solo pasan los códigos del contrato y los ecos validados (`status`, `fields`,
 * `Retry-After` entero). El texto del backend nunca cruza.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { CID, DETALLE_PANEL, EMPRESA, EMPRESA_ADMIN, FILA_OFERTA, FILA_PANEL, INV, INVITACION, OFERTA_DETALLE, OFF, PAP, PAIS, RECLUTADOR, REC, SECTOR, TOKEN } from "./helpers/company";
import * as company from "@/app/api/company/route";
import * as recruiters from "@/app/api/company/recruiters/route";
import * as recruiter from "@/app/api/company/recruiters/[id]/route";
import * as invitations from "@/app/api/company/invitations/route";
import * as invitation from "@/app/api/company/invitations/[id]/route";
import * as accept from "@/app/api/invitations/accept/route";
import * as offers from "@/app/api/company/offers/route";
import * as offer from "@/app/api/company/offers/[id]/route";
import * as publish from "@/app/api/company/offers/[id]/publish/route";
import * as pause from "@/app/api/company/offers/[id]/pause/route";
import * as close from "@/app/api/company/offers/[id]/close/route";
import * as panel from "@/app/api/company/offers/[id]/applications/route";
import * as panelApp from "@/app/api/company/applications/[id]/route";
import * as panelStatus from "@/app/api/company/applications/[id]/status/route";
import * as favorite from "@/app/api/company/applications/[id]/favorite/route";
import * as admin from "@/app/api/admin/companies/route";
import * as verify from "@/app/api/admin/companies/[id]/verify/route";
import * as unverify from "@/app/api/admin/companies/[id]/unverify/route";
import * as membership from "@/app/api/admin/companies/[id]/membership/route";
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
const pagina = <T>(items: T[], next_cursor: string | null = null) => ({ items, next_cursor });
const ruta = (u: string) => {
  const x = new URL(u);
  return `${x.pathname.replace("/api/v1", "")}${x.search}`;
};

const EMPRESA_IN = { name: "Café Nuevo S.A.", tax_id: "1234567-8", website: "https://cafenuevo.example", phone: null, description: null, country_id: PAIS, employment_sector_id: SECTOR };

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mi empresa", () => {
  it("GET /api/company -> GET /company con Bearer; POST crea con POST /companies; PUT reemplaza", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, EMPRESA()) : c.method === "POST" ? jsonRes(201, EMPRESA()) : jsonRes(204)));
    expect((await company.GET(rq("/api/company"))).status).toBe(200);
    expect((await company.POST(rq("/api/company", "POST", { ...EMPRESA_IN, verified: true, my_role: "x" }))).status).toBe(201);
    expect((await company.PUT(rq("/api/company", "PUT", EMPRESA_IN))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["GET", "/company"],
      ["POST", "/companies"],
      ["PUT", "/company"],
    ]);
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
    // Solo viajan los campos de CompanyInput: lo calculado por el servidor no se puede mandar.
    expect(llamadas[1].body).toEqual(EMPRESA_IN);
  });
  it("cuerpo que no es CompanyInput -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, EMPRESA()));
    for (const malo of [{ ...EMPRESA_IN, name: 5 }, { ...EMPRESA_IN, country_id: "x" }, { ...EMPRESA_IN, website: 3 }, [1]]) {
      expect((await company.POST(rq("/api/company", "POST", malo))).status).toBe(422);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  const errores: [number, string][] = [
    [404, "no_encontrado"],
    [409, "ya_tiene_empresa"],
    [409, "empresa_duplicada"],
    [409, "nit_inmutable"],
    [422, "datos_invalidos"],
    [422, "campo_no_permitido"],
    [403, "sin_permiso"],
    [403, "cuenta_no_disponible"],
  ];
  for (const [estado, codigo] of errores) {
    it(`${estado} ${codigo} se reenvía con su código, sin el texto del backend`, async () => {
      stubFetch(() => jsonRes(estado, { error: codigo, message: "NIT 1234567-8 de Café Nuevo" }));
      const res = await company.PUT(rq("/api/company", "PUT", EMPRESA_IN));
      const texto = await res.text();
      expect([res.status, JSON.parse(texto)]).toEqual([estado, { error: codigo }]);
      expect(texto).not.toContain("Café");
    });
  }
  it("429 al crear reenvía Retry-After entero", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "600" } }));
    const res = await company.POST(rq("/api/company", "POST", EMPRESA_IN));
    expect([res.status, res.headers.get("retry-after")]).toEqual([429, "600"]);
  });
});

describe("reclutadores e invitaciones", () => {
  it("lista y quita reclutadores", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, pagina([RECLUTADOR()])) : jsonRes(204)));
    expect((await recruiters.GET(rq("/api/company/recruiters?limit=50&x=1"))).status).toBe(200);
    expect((await recruiter.DELETE(rq(`/api/company/recruiters/${REC}`, "DELETE"), ctx(REC))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["GET", "/company/recruiters?limit=50"],
      ["DELETE", `/company/recruiters/${REC}`],
    ]);
  });
  it("409 ultimo_administrador se conserva; id mal formado -> 404 sin backend", async () => {
    stubFetch(() => jsonRes(409, { error: "ultimo_administrador" }));
    expect(await (await recruiter.DELETE(rq("/x", "DELETE"), ctx(REC))).json()).toEqual({ error: "ultimo_administrador" });
    const { fn } = stubFetch(() => jsonRes(204));
    expect((await recruiter.DELETE(rq("/x", "DELETE"), ctx("nope"))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("crear invitación reenvía solo {email, role} y devuelve el token una vez (201)", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, INVITACION({ token: TOKEN })));
    const res = await invitations.POST(rq("/api/company/invitations", "POST", { email: "luis@example.test", role: "recruiter", company_id: CID }));
    expect(res.status).toBe(201);
    expect((await res.json()).token).toBe(TOKEN);
    expect(llamadas[0].body).toEqual({ email: "luis@example.test", role: "recruiter" });
  });
  it("una invitación con rol fuera de recruiter/company_admin o sin correo -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, {}));
    for (const malo of [{ email: "a@b.co", role: "admin" }, { email: "", role: "recruiter" }, { role: "recruiter" }]) {
      expect((await invitations.POST(rq("/api/company/invitations", "POST", malo))).status).toBe(422);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  it("lista y revoca invitaciones", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, pagina([INVITACION()])) : jsonRes(204)));
    await invitations.GET(rq("/api/company/invitations"));
    await invitation.DELETE(rq("/x", "DELETE"), ctx(INV));
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["GET", "/company/invitations"],
      ["DELETE", `/company/invitations/${INV}`],
    ]);
  });
  it("aceptar reenvía solo {token}; 404 invitacion_invalida y 429 se conservan", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, { company: { id: CID, name: "Café Nuevo S.A." }, role: "recruiter" }));
    expect((await accept.POST(rq("/api/invitations/accept", "POST", { token: TOKEN, email: "x" }))).status).toBe(200);
    expect(llamadas[0]).toMatchObject({ method: "POST", url: `${API}/invitations/accept`, body: { token: TOKEN } });
    stubFetch(() => jsonRes(404, { error: "invitacion_invalida" }));
    expect(await (await accept.POST(rq("/x", "POST", { token: TOKEN }))).json()).toEqual({ error: "invitacion_invalida" });
    const { fn } = stubFetch(() => jsonRes(200, {}));
    for (const malo of [{}, { token: "" }, { token: 5 }, { token: "a".repeat(300) }]) expect((await accept.POST(rq("/x", "POST", malo))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("ofertas del reclutador", () => {
  const ENTRADA = (() => {
    const d: Record<string, unknown> = { ...OFERTA_DETALLE() };
    for (const k of ["id", "status", "required_driver_license", "publication_date", "closed_at", "created_at", "updated_at", "applications_count", "created_by"]) delete d[k];
    return d;
  })();
  it("lista con limit, cursor y status; crea con POST (201); lee, reemplaza y borra", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, c.url.endsWith(OFF) ? OFERTA_DETALLE() : pagina([FILA_OFERTA()])) : c.method === "POST" ? jsonRes(201, OFERTA_DETALLE()) : jsonRes(204)));
    expect((await offers.GET(rq("/api/company/offers?status=draft&limit=20&q=x"))).status).toBe(200);
    expect((await offers.POST(rq("/api/company/offers", "POST", ENTRADA))).status).toBe(201);
    expect((await offer.GET(rq("/x"), ctx(OFF))).status).toBe(200);
    expect((await offer.PUT(rq("/x", "PUT", ENTRADA), ctx(OFF))).status).toBe(204);
    expect((await offer.DELETE(rq("/x", "DELETE"), ctx(OFF))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["GET", "/company/offers?limit=20&status=draft"],
      ["POST", "/company/offers"],
      ["GET", `/company/offers/${OFF}`],
      ["PUT", `/company/offers/${OFF}`],
      ["DELETE", `/company/offers/${OFF}`],
    ]);
  });
  it("OF4: solo viajan los campos de OfferInput; edad, género, estado civil o «featured» nunca", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, OFERTA_DETALLE()));
    await offers.POST(rq("/api/company/offers", "POST", { ...ENTRADA, age_range_from: 20, gender_preference_id: "x", marital_status_id: "y", featured: true, status: "published" }));
    expect(llamadas[0].body).toEqual(ENTRADA);
  });
  it("estado del listado fuera de draft/published/paused/closed -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(200, pagina([])));
    expect((await offers.GET(rq("/api/company/offers?status=archived"))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("publicar -> 200 con {id, status, publication_date}; pausar y cerrar -> 204", async () => {
    const { llamadas } = stubFetch((c) => (c.url.endsWith("/publish") ? jsonRes(200, { id: OFF, status: "published", publication_date: "2026-11-12" }) : jsonRes(204)));
    expect((await publish.POST(rq("/x", "POST"), ctx(OFF))).status).toBe(200);
    expect((await pause.POST(rq("/x", "POST"), ctx(OFF))).status).toBe(204);
    expect((await close.POST(rq("/x", "POST"), ctx(OFF))).status).toBe(204);
    expect(llamadas.map((c) => ruta(c.url))).toEqual([`/company/offers/${OFF}/publish`, `/company/offers/${OFF}/pause`, `/company/offers/${OFF}/close`]);
  });
  it("422 oferta_incompleta conserva `fields` solo con nombres conocidos", async () => {
    stubFetch(() => jsonRes(422, { error: "oferta_incompleta", message: "x", fields: ["description", "requirements", "<script>", 5] }));
    const res = await publish.POST(rq("/x", "POST"), ctx(OFF));
    expect([res.status, await res.json()]).toEqual([422, { error: "oferta_incompleta", fields: ["description", "requirements"] }]);
  });
  const errores: [number, string][] = [
    [403, "empresa_no_verificada"],
    [403, "membresia_vencida"],
    [409, "estado_invalido"],
    [409, "oferta_con_aplicaciones"],
    [409, "confidencial_inmutable"],
    [404, "no_encontrado"],
    [413, "cuerpo_demasiado_grande"],
  ];
  for (const [estado, codigo] of errores) {
    it(`${estado} ${codigo} se reenvía con su código`, async () => {
      stubFetch(() => jsonRes(estado, { error: codigo, message: "texto del backend" }));
      const res = await offer.PUT(rq("/x", "PUT", ENTRADA), ctx(OFF));
      expect([res.status, await res.json()]).toEqual([estado, { error: codigo }]);
    });
  }
});

describe("panel del reclutador (PA9: filtros y orden cerrados)", () => {
  it("lista con limit, cursor, status, favorite y sort; nada más viaja", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([FILA_PANEL()])));
    const res = await panel.GET(rq(`/api/company/offers/${OFF}/applications?status=under_review&favorite=true&sort=oldest&limit=20&cursor=abc&name=Ana&age=30&gender=f&photo=1`), ctx(OFF));
    expect(res.status).toBe(200);
    const u = new URL(llamadas[0].url);
    expect(u.pathname).toBe(`/api/v1/company/offers/${OFF}/applications`);
    expect(Object.fromEntries(u.searchParams)).toEqual({ status: "under_review", favorite: "true", sort: "oldest", limit: "20", cursor: "abc" });
  });
  for (const q of ["sort=name", "sort=match", "sort=", "favorite=si", "status=archivada", "limit=0"]) {
    it(`${q} -> 422 sin backend`, async () => {
      const { fn } = stubFetch(() => jsonRes(200, pagina([])));
      expect((await panel.GET(rq(`/api/company/offers/${OFF}/applications?${q}`), ctx(OFF))).status).toBe(422);
      expect(fn).not.toHaveBeenCalled();
    });
  }
  it("detalle; 429 con Retry-After; 403 de la empresa se conservan", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, DETALLE_PANEL()));
    expect((await panelApp.GET(rq("/x"), ctx(PAP))).status).toBe(200);
    expect(ruta(llamadas[0].url)).toBe(`/company/applications/${PAP}`);
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "1200" } }));
    const r = await panelApp.GET(rq("/x"), ctx(PAP));
    expect([r.status, r.headers.get("retry-after")]).toEqual([429, "1200"]);
    for (const codigo of ["empresa_no_verificada", "membresia_vencida"]) {
      stubFetch(() => jsonRes(403, { error: codigo }));
      expect(await (await panelApp.GET(rq("/x"), ctx(PAP))).json()).toEqual({ error: codigo });
    }
  });
  it("cambiar de estado reenvía {to, note} y devuelve el detalle; la nota vacía no viaja", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, DETALLE_PANEL({ status: "under_review" })));
    expect((await panelStatus.POST(rq("/x", "POST", { to: "under_review", note: "Buen perfil", extra: 1 }), ctx(PAP))).status).toBe(200);
    await panelStatus.POST(rq("/x", "POST", { to: "shortlisted", note: "   " }), ctx(PAP));
    expect(llamadas.map((c) => [ruta(c.url), c.body])).toEqual([
      [`/company/applications/${PAP}/status`, { to: "under_review", note: "Buen perfil" }],
      [`/company/applications/${PAP}/status`, { to: "shortlisted" }],
    ]);
  });
  it("a applied o withdrawn, un estado desconocido o una nota de más de 500 caracteres -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(200, {}));
    for (const malo of [{ to: "applied" }, { to: "withdrawn" }, { to: "otro" }, {}, { to: "hired", note: "ñ".repeat(501) }, { to: "hired", note: 5 }]) {
      expect((await panelStatus.POST(rq("/x", "POST", malo), ctx(PAP))).status, JSON.stringify(malo).slice(0, 40)).toBe(422);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  it("409 estado_invalido conserva el estado vigente", async () => {
    stubFetch(() => jsonRes(409, { error: "estado_invalido", status: "rejected" }));
    expect(await (await panelStatus.POST(rq("/x", "POST", { to: "hired" }), ctx(PAP))).json()).toEqual({ error: "estado_invalido", status: "rejected" });
  });
  it("favorito: PUT y DELETE -> 204", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    expect((await favorite.PUT(rq("/x", "PUT"), ctx(PAP))).status).toBe(204);
    expect((await favorite.DELETE(rq("/x", "DELETE"), ctx(PAP))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["PUT", `/company/applications/${PAP}/favorite`],
      ["DELETE", `/company/applications/${PAP}/favorite`],
    ]);
  });
});

describe("administración de plataforma", () => {
  it("lista con verified, limit y cursor; verify, unverify y membresía", async () => {
    const { llamadas } = stubFetch((c) => (c.method === "GET" ? jsonRes(200, pagina([EMPRESA_ADMIN()])) : jsonRes(204)));
    expect((await admin.GET(rq("/api/admin/companies?verified=false&limit=20&name=x"))).status).toBe(200);
    expect((await verify.POST(rq("/x", "POST"), ctx(CID))).status).toBe(204);
    expect((await unverify.POST(rq("/x", "POST"), ctx(CID))).status).toBe(204);
    const m = { membership_type: "business", start_date: "2026-11-01", expiration_date: "2027-11-01" };
    expect((await membership.PUT(rq("/x", "PUT", { ...m, company_id: "x" }), ctx(CID))).status).toBe(204);
    expect(llamadas.map((c) => [c.method, ruta(c.url)])).toEqual([
      ["GET", "/admin/companies?verified=false&limit=20"],
      ["POST", `/admin/companies/${CID}/verify`],
      ["POST", `/admin/companies/${CID}/unverify`],
      ["PUT", `/admin/companies/${CID}/membership`],
    ]);
    expect(llamadas[3].body).toEqual(m);
  });
  it("verified distinto de true/false o fechas sin formato -> 422 sin backend; 403 sin_permiso se conserva", async () => {
    const { fn } = stubFetch(() => jsonRes(200, pagina([])));
    expect((await admin.GET(rq("/api/admin/companies?verified=si"))).status).toBe(422);
    expect((await membership.PUT(rq("/x", "PUT", { membership_type: "business", start_date: "1/11/2026", expiration_date: "2027-11-01" }), ctx(CID))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
    stubFetch(() => jsonRes(403, { error: "sin_permiso" }));
    expect(await (await verify.POST(rq("/x", "POST"), ctx(CID))).json()).toEqual({ error: "sin_permiso" });
  });
});

describe("catálogos que usa el formulario de empresa y de oferta", () => {
  it("countries, driver-licenses, skills, languages y academic-levels se sirven", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, []));
    for (const n of ["countries", "driver-licenses", "skills", "languages", "academic-levels"]) {
      expect((await catalogs.GET(rq(`/api/catalogs/${n}`), { params: Promise.resolve({ nombre: n }) })).status, n).toBe(200);
    }
    expect(llamadas).toHaveLength(5);
  });
});

describe("sin sesión: 401 JSON y el backend no se toca", () => {
  it("todas las rutas nuevas responden 401", async () => {
    const { fn } = stubFetch(() => jsonRes(200, {}));
    const sin = (method = "GET", body?: unknown) => rq("/x", method, body, null);
    const rs = await Promise.all([
      company.GET(sin()),
      company.POST(sin("POST", EMPRESA_IN)),
      company.PUT(sin("PUT", EMPRESA_IN)),
      recruiters.GET(sin()),
      recruiter.DELETE(sin("DELETE"), ctx(REC)),
      invitations.GET(sin()),
      invitations.POST(sin("POST", { email: "a@b.co", role: "recruiter" })),
      invitation.DELETE(sin("DELETE"), ctx(INV)),
      accept.POST(sin("POST", { token: TOKEN })),
      offers.GET(sin()),
      offers.POST(sin("POST", { title: "Oferta" })),
      offer.GET(sin(), ctx(OFF)),
      offer.PUT(sin("PUT", { title: "Oferta" }), ctx(OFF)),
      offer.DELETE(sin("DELETE"), ctx(OFF)),
      publish.POST(sin("POST"), ctx(OFF)),
      pause.POST(sin("POST"), ctx(OFF)),
      close.POST(sin("POST"), ctx(OFF)),
      panel.GET(sin(), ctx(OFF)),
      panelApp.GET(sin(), ctx(PAP)),
      panelStatus.POST(sin("POST", { to: "under_review" }), ctx(PAP)),
      favorite.PUT(sin("PUT"), ctx(PAP)),
      favorite.DELETE(sin("DELETE"), ctx(PAP)),
      admin.GET(sin()),
      verify.POST(sin("POST"), ctx(CID)),
      unverify.POST(sin("POST"), ctx(CID)),
      membership.PUT(sin("PUT", { membership_type: "business", start_date: "2026-11-01", expiration_date: "2027-11-01" }), ctx(CID)),
    ]);
    for (const r of rs) expect(r.status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
});
