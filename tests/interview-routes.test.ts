// @vitest-environment node
/** F1/F13 (capa servidor): reenvío seguro de entrevistas hacia el contrato simulado de core-api. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { SID, SESION, SCORE, RECRUITERS, LEVELS, PROGRESO, REC_ID, LVL_ID, RESUMEN, T1, items, pagina } from "./helpers/interview";
import * as recruiters from "@/app/api/recruiters/route";
import * as levels from "@/app/api/levels/route";
import * as progress from "@/app/api/progress/route";
import * as interviews from "@/app/api/interviews/route";
import * as one from "@/app/api/interviews/[id]/route";
import * as pause from "@/app/api/interviews/[id]/pause/route";
import * as resume from "@/app/api/interviews/[id]/resume/route";
import * as abandon from "@/app/api/interviews/[id]/abandon/route";
import * as finish from "@/app/api/interviews/[id]/finish/route";
import * as turns from "@/app/api/interviews/[id]/turns/route";
import * as score from "@/app/api/interviews/[id]/score/route";

const COOKIE = "jo_session=acc-111; jo_refresh=ref-222";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rq = (url: string, method = "GET", body?: unknown, cookie: string | null = COOKIE) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("lecturas: recruiters, niveles, progreso y lista", () => {
  const casos: [string, () => Promise<Response>, string, unknown][] = [
    ["recruiters", () => recruiters.GET(rq("/api/recruiters")), "/api/v1/recruiters", items(RECRUITERS)],
    ["levels", () => levels.GET(rq("/api/levels")), "/api/v1/levels", items(LEVELS)],
    ["progress", () => progress.GET(rq("/api/progress")), "/api/v1/progress", items(PROGRESO)],
    ["interviews", () => interviews.GET(rq("/api/interviews")), "/api/v1/interviews", pagina([RESUMEN()], null)],
  ];
  for (const [nombre, llamar, ruta, cuerpo] of casos) {
    it(`GET ${nombre} reenvía con Bearer a ${ruta} y devuelve el JSON`, async () => {
      const { llamadas } = stubFetch(() => jsonRes(200, cuerpo));
      const res = await llamar();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(cuerpo);
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].url).toBe(`http://core-api:8080${ruta}`);
      expect(llamadas[0].method).toBe("GET");
      expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  }
});

describe("GET /api/interviews pagina por cursor y filtra por status", () => {
  const url = "http://core-api:8080/api/v1/interviews";
  it("reenvía limit, cursor y status al backend", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([RESUMEN()], "sig")));
    const res = await interviews.GET(rq("/api/interviews?limit=5&cursor=abc_-.~%3D&status=completed"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pagina([RESUMEN()], "sig"));
    const u = new URL(llamadas[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(url);
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: "5", cursor: "abc_-.~=", status: "completed" });
  });
  it("sin parámetros no inventa ninguno", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([])));
    await interviews.GET(rq("/api/interviews"));
    expect(llamadas[0].url).toBe(url);
  });
  it("ignora parámetros que no son del contrato", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([])));
    await interviews.GET(rq("/api/interviews?status=paused&user_id=9&sql=x"));
    expect(llamadas[0].url).toBe(`${url}?status=paused`);
  });
  for (const q of ["limit=0", "limit=51", "limit=-1", "limit=abc", "limit=2.5", "status=otro", "status=", "cursor=", `cursor=${"a".repeat(600)}`, "cursor=%3Cscript%3E"]) {
    it(`${q.slice(0, 30)} -> 422 datos_invalidos sin tocar el backend`, async () => {
      const { fn } = stubFetch(() => jsonRes(200, pagina([])));
      const res = await interviews.GET(rq(`/api/interviews?${q}`));
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "datos_invalidos" });
      expect(fn).not.toHaveBeenCalled();
    });
  }
  it("acepta los bordes limit=1 y limit=50 y los cuatro estados", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([])));
    for (const q of ["limit=1", "limit=50", "status=in_progress", "status=paused", "status=completed", "status=abandoned"]) {
      expect((await interviews.GET(rq(`/api/interviews?${q}`))).status).toBe(200);
    }
    expect(llamadas).toHaveLength(6);
  });
});

describe("crear y leer una sesión", () => {
  it("POST /api/interviews reenvía solo recruiter_id y level_id y devuelve 201", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, SESION()));
    const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID, extra: "x" }));
    expect(res.status).toBe(201);
    expect(llamadas[0]).toMatchObject({ url: "http://core-api:8080/api/v1/interviews", method: "POST", body: { recruiter_id: REC_ID, level_id: LVL_ID } });
    expect(llamadas[0].body).not.toHaveProperty("extra");
  });
  it("ids mal formados -> 422 sin tocar el backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, SESION()));
    const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: "x", level_id: LVL_ID }));
    expect(res.status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("409 sesion_en_curso conserva el id de la sesión activa", async () => {
    stubFetch(() => jsonRes(409, { error: "sesion_en_curso", session_id: SID }));
    const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "sesion_en_curso", session_id: SID });
  });
  it("409 sesion_en_curso con un session_id que no es UUID no lo reenvía", async () => {
    stubFetch(() => jsonRes(409, { error: "sesion_en_curso", session_id: "<script>" }));
    const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID }));
    expect(await res.json()).toEqual({ error: "sesion_en_curso" });
  });
  it("GET /api/interviews/{id} reenvía; id mal formado -> 404 sin backend", async () => {
    const { llamadas, fn } = stubFetch(() => jsonRes(200, SESION()));
    expect((await one.GET(rq(`/api/interviews/${SID}`), ctx(SID))).status).toBe(200);
    expect(llamadas[0].url).toBe(`http://core-api:8080/api/v1/interviews/${SID}`);
    fn.mockClear();
    const mal = await one.GET(rq("/api/interviews/zzz"), ctx("zzz"));
    expect(mal.status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("DELETE /api/interviews/{id} -> 204", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await one.DELETE(rq(`/api/interviews/${SID}`, "DELETE"), ctx(SID));
    expect(res.status).toBe(204);
    expect(llamadas[0]).toMatchObject({ method: "DELETE", url: `http://core-api:8080/api/v1/interviews/${SID}` });
  });
});

describe("acciones sobre una sesión", () => {
  const acciones: [string, (r: Request, c: ReturnType<typeof ctx>) => Promise<Response>][] = [
    ["pause", pause.POST],
    ["resume", resume.POST],
    ["abandon", abandon.POST],
  ];
  for (const [nombre, handler] of acciones) {
    it(`POST ${nombre} -> 204 hacia /interviews/{id}/${nombre}`, async () => {
      const esperado = nombre === "resume" ? 200 : 204;
      const { llamadas } = stubFetch(() => (esperado === 204 ? jsonRes(204) : jsonRes(200, { turn: T1 })));
      const res = await handler(rq(`/api/interviews/${SID}/${nombre}`, "POST"), ctx(SID));
      expect(res.status).toBe(esperado);
      expect(llamadas[0]).toMatchObject({ method: "POST", url: `http://core-api:8080/api/v1/interviews/${SID}/${nombre}` });
    });
  }
  it("POST finish -> 200 con el score; 422 entrevista_muy_corta se conserva", async () => {
    stubFetch(() => jsonRes(200, SCORE()));
    const ok = await finish.POST(rq(`/api/interviews/${SID}/finish`, "POST"), ctx(SID));
    expect(ok.status).toBe(200);
    expect((await ok.json()).score).toBe(78);
    stubFetch(() => jsonRes(422, { error: "entrevista_muy_corta" }));
    const corta = await finish.POST(rq(`/api/interviews/${SID}/finish`, "POST"), ctx(SID));
    expect(corta.status).toBe(422);
    expect(await corta.json()).toEqual({ error: "entrevista_muy_corta" });
  });
  it("finish: 409 estado_invalido y turno_en_proceso se conservan; score en una sesión sin terminar -> 409 estado_invalido", async () => {
    for (const codigo of ["estado_invalido", "turno_en_proceso"]) {
      stubFetch(() => jsonRes(409, { error: codigo }));
      const res = await finish.POST(rq(`/api/interviews/${SID}/finish`, "POST"), ctx(SID));
      expect([res.status, await res.json()]).toEqual([409, { error: codigo }]);
    }
    stubFetch(() => jsonRes(409, { error: "estado_invalido" }));
    const sc = await score.GET(rq(`/api/interviews/${SID}/score`), ctx(SID));
    expect([sc.status, await sc.json()]).toEqual([409, { error: "estado_invalido" }]);
    stubFetch(() => jsonRes(409, { error: "estado_invalido" }));
    const rs = await resume.POST(rq(`/api/interviews/${SID}/resume`, "POST"), ctx(SID));
    expect([rs.status, await rs.json()]).toEqual([409, { error: "estado_invalido" }]);
  });
  it("GET score reenvía", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, SCORE()));
    const res = await score.GET(rq(`/api/interviews/${SID}/score`), ctx(SID));
    expect(res.status).toBe(200);
    expect(llamadas[0].url).toBe(`http://core-api:8080/api/v1/interviews/${SID}/score`);
  });
  it("POST turns reenvía solo {text} y devuelve 201", async () => {
    const cuerpo = { turn: { seq: 2, speaker: "recruiter", kind: "follow_up", text: "¿Y qué resultado tuvo?" }, done: false };
    const { llamadas } = stubFetch(() => jsonRes(201, cuerpo));
    const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "Hice una API", otro: 1 }), ctx(SID));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(cuerpo);
    expect(llamadas[0].body).toEqual({ text: "Hice una API" });
  });
  it("turns: el texto se recorta y el límite de 4000 cuenta caracteres Unicode, no unidades UTF-16", async () => {
    const cuerpo = { turn: { seq: 2, speaker: "recruiter", kind: "closing", text: "ok" }, done: false };
    const { llamadas } = stubFetch(() => jsonRes(201, cuerpo));
    const emojis = "😀".repeat(4000); // 8000 unidades UTF-16, 4000 caracteres
    for (const text of [emojis, `  ${"a".repeat(4000)}  \n`]) {
      expect((await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text }), ctx(SID))).status).toBe(201);
    }
    expect(llamadas.map((c) => (c.body as { text: string }).text)).toEqual([emojis, "a".repeat(4000)]);
    const { fn } = stubFetch(() => jsonRes(201, cuerpo));
    for (const text of ["😀".repeat(4001), `${"a".repeat(4000)}😀`, `  ${"ñ".repeat(4001)} `]) {
      expect((await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text }), ctx(SID))).status).toBe(422);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  it("turns: texto vacío o de más de 4000 caracteres -> 422 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, {}));
    for (const text of ["", "   \n ", "a".repeat(4001), 5]) {
      const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text }), ctx(SID));
      expect(res.status).toBe(422);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  it("id mal formado en cualquier acción -> 404 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    for (const h of [pause.POST, resume.POST, abandon.POST, finish.POST, turns.POST, score.GET]) {
      const res = await h(rq("/api/interviews/no/x", "POST", { text: "a" }), ctx("no"));
      expect(res.status).toBe(404);
    }
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("errores del contrato (F13): solo códigos conocidos, nunca texto del backend", () => {
  const casos: [number, string, Record<string, unknown>][] = [
    [403, "nivel_bloqueado", { error: "nivel_bloqueado" }],
    [403, "limite_del_plan", { error: "limite_del_plan" }],
    [403, "cuenta_no_disponible", { error: "cuenta_no_disponible" }],
    [409, "nivel_no_disponible", { error: "nivel_no_disponible" }],
    [409, "turno_en_proceso", { error: "turno_en_proceso" }],
    [409, "estado_invalido", { error: "estado_invalido" }],
    [422, "datos_invalidos", { error: "datos_invalidos" }],
    [429, "demasiados_intentos", { error: "demasiados_intentos" }],
    [503, "motor_no_disponible", { error: "motor_no_disponible" }],
  ];
  for (const [estado, codigo, cuerpo] of casos) {
    it(`${estado} ${codigo} se reenvía con su código`, async () => {
      stubFetch(() => jsonRes(estado, cuerpo));
      const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "hola" }), ctx(SID));
      expect(res.status).toBe(estado);
      expect(await res.json()).toEqual({ error: codigo });
    });
  }
  it("403 limite_del_plan conserva renews_at (ISO 8601)", async () => {
    stubFetch(() => jsonRes(403, { error: "limite_del_plan", message: "texto", renews_at: "2026-12-01T00:00:00Z" }));
    const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "limite_del_plan", renews_at: "2026-12-01T00:00:00Z" });
  });
  it("403 limite_del_plan con un renews_at que no es una fecha no lo reenvía", async () => {
    for (const renews_at of ["<script>", "mañana", 5, "2026-12-01"]) {
      stubFetch(() => jsonRes(403, { error: "limite_del_plan", renews_at }));
      const res = await interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID }));
      expect(await res.json()).toEqual({ error: "limite_del_plan" });
    }
  });
  it("429 reenvía Retry-After solo si son segundos; nunca otro encabezado", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "30", "x-interno": "1" } }));
    const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "hola" }), ctx(SID));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("x-interno")).toBeNull();
    stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" } }));
    const otra = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "hola" }), ctx(SID));
    expect(otra.headers.get("retry-after")).toBeNull();
  });
  it("un 503 sin código ni cuerpo igual se informa como motor_no_disponible", async () => {
    stubFetch(() => new Response("upstream down", { status: 503 }));
    const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "hola" }), ctx(SID));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "motor_no_disponible" });
  });
  it("un código desconocido o un detalle técnico NO se reenvía: 502 genérico", async () => {
    stubFetch(() => jsonRes(409, { error: "SELECT * FROM x", detail: "stack trace" }));
    const res = await turns.POST(rq(`/api/interviews/${SID}/turns`, "POST", { text: "mi respuesta secreta" }), ctx(SID));
    expect(res.status).toBe(502);
    const texto = await res.text();
    expect(texto).toBe(JSON.stringify({ error: "servicio_no_disponible" }));
    expect(texto).not.toContain("secreta");
  });
  it("si el backend no responde -> 502 servicio_no_disponible", async () => {
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const res = await interviews.GET(rq("/api/interviews"));
    expect(res.status).toBe(502);
  });
});

describe("sin sesión: 401 JSON y el backend no se toca", () => {
  it("todas las rutas responden 401", async () => {
    const { fn } = stubFetch(() => jsonRes(200, {}));
    const rs = await Promise.all([
      recruiters.GET(rq("/api/recruiters", "GET", undefined, null)),
      levels.GET(rq("/api/levels", "GET", undefined, null)),
      progress.GET(rq("/api/progress", "GET", undefined, null)),
      interviews.GET(rq("/api/interviews", "GET", undefined, null)),
      interviews.POST(rq("/api/interviews", "POST", { recruiter_id: REC_ID, level_id: LVL_ID }, null)),
      one.GET(rq("/x", "GET", undefined, null), ctx(SID)),
      one.DELETE(rq("/x", "DELETE", undefined, null), ctx(SID)),
      pause.POST(rq("/x", "POST", undefined, null), ctx(SID)),
      resume.POST(rq("/x", "POST", undefined, null), ctx(SID)),
      abandon.POST(rq("/x", "POST", undefined, null), ctx(SID)),
      finish.POST(rq("/x", "POST", undefined, null), ctx(SID)),
      turns.POST(rq("/x", "POST", { text: "a" }, null), ctx(SID)),
      score.GET(rq("/x", "GET", undefined, null), ctx(SID)),
    ]);
    for (const r of rs) expect(r.status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
});
