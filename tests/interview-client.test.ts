/** Cliente tipado del contrato simulado + F13 (errores en español, sin texto técnico). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { SID, SESION, SCORE, REC_ID, LVL_ID, RECRUITERS, RESUMEN, items, pagina } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { es } from "@/lib/messages/es";
import { goTo } from "@/lib/navigate";
import { interviewsApi } from "@/lib/interviews/client";
import { interviewErrorKey, interviewErrorText } from "@/lib/interviews/errors";
import { formatDate, formatRenewal } from "@/lib/interviews/format";
import { countChars } from "@/lib/interviews/types";

const OFFER_ID = "66666666-6666-4666-8666-666666666666";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("interviewsApi: una función por endpoint", () => {
  const casos: [string, () => Promise<unknown>, string, string, unknown][] = [
    ["recruiters", () => interviewsApi.recruiters(), "GET", "/api/recruiters", undefined],
    ["levels", () => interviewsApi.levels(), "GET", "/api/levels", undefined],
    ["progress", () => interviewsApi.progress(), "GET", "/api/progress", undefined],
    ["list", () => interviewsApi.list(), "GET", "/api/interviews", undefined],
    ["create", () => interviewsApi.create(REC_ID, LVL_ID), "POST", "/api/interviews", { recruiter_id: REC_ID, level_id: LVL_ID }],
    ["create con oferta", () => interviewsApi.create(REC_ID, LVL_ID, OFFER_ID), "POST", "/api/interviews", { recruiter_id: REC_ID, level_id: LVL_ID, job_offer_id: OFFER_ID }],
    ["get", () => interviewsApi.get(SID), "GET", `/api/interviews/${SID}`, undefined],
    ["pause", () => interviewsApi.pause(SID), "POST", `/api/interviews/${SID}/pause`, undefined],
    ["resume", () => interviewsApi.resume(SID), "POST", `/api/interviews/${SID}/resume`, undefined],
    ["abandon", () => interviewsApi.abandon(SID), "POST", `/api/interviews/${SID}/abandon`, undefined],
    ["finish", () => interviewsApi.finish(SID), "POST", `/api/interviews/${SID}/finish`, undefined],
    ["sendTurn", () => interviewsApi.sendTurn(SID, "hola"), "POST", `/api/interviews/${SID}/turns`, { text: "hola" }],
    ["score", () => interviewsApi.score(SID), "GET", `/api/interviews/${SID}/score`, undefined],
    ["remove", () => interviewsApi.remove(SID), "DELETE", `/api/interviews/${SID}`, undefined],
  ];
  for (const [nombre, llamar, method, url, body] of casos) {
    it(`${nombre} -> ${method} ${url}`, async () => {
      const { llamadas } = stubFetch(() => jsonRes(200, SESION()));
      const r = (await llamar()) as { status: number };
      expect(r.status).toBe(200);
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toMatchObject({ url, method });
      expect(llamadas[0].body).toEqual(body);
    });
  }
  it("devuelve data tipada en éxito y error null", async () => {
    stubFetch(() => jsonRes(200, SCORE()));
    const r = await interviewsApi.score(SID);
    expect(r.error).toBeNull();
    expect(r.data?.score).toBe(78);
  });
  it("204 -> data null sin error", async () => {
    stubFetch(() => jsonRes(204));
    const r = await interviewsApi.pause(SID);
    expect(r).toMatchObject({ status: 204, data: null, error: null });
  });
  it("conserva el código y el id de la sesión activa en un 409", async () => {
    stubFetch(() => jsonRes(409, { error: "sesion_en_curso", session_id: SID }));
    const r = await interviewsApi.create(REC_ID, LVL_ID);
    expect(r).toMatchObject({ status: 409, error: "sesion_en_curso", sessionId: SID });
  });
  it("conserva renews_at en un 403 limite_del_plan", async () => {
    stubFetch(() => jsonRes(403, { error: "limite_del_plan", renews_at: "2026-12-01T00:00:00Z" }));
    const r = await interviewsApi.create(REC_ID, LVL_ID);
    expect(r).toMatchObject({ status: 403, error: "limite_del_plan", renewsAt: "2026-12-01T00:00:00Z" });
  });
  it("lee Retry-After (segundos) de un 429; si no es un número lo ignora", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "content-type": "application/json", "retry-after": "17" } }));
    expect(await interviewsApi.sendTurn(SID, "hola")).toMatchObject({ status: 429, retryAfter: 17 });
    stubFetch(() => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "mañana" } }));
    expect((await interviewsApi.sendTurn(SID, "hola")).retryAfter).toBeNull();
    stubFetch(() => jsonRes(429, { error: "demasiados_intentos" }));
    expect((await interviewsApi.sendTurn(SID, "hola")).retryAfter).toBeNull();
  });
  it("un fallo de red es status 0", async () => {
    stubFetch(() => {
      throw new Error("offline");
    });
    expect(await interviewsApi.get(SID)).toMatchObject({ status: 0, data: null });
  });
  it("401 lleva a /sign-in", async () => {
    stubFetch(() => jsonRes(401, { error: "sesion_expirada" }));
    await interviewsApi.get(SID);
    expect(goTo).toHaveBeenCalledWith("/sign-in");
  });
});

describe("listados: siempre {items}; solo /interviews pagina por cursor", () => {
  it("recruiters, levels y progress devuelven {items}", async () => {
    stubFetch(() => jsonRes(200, items(RECRUITERS)));
    const r = await interviewsApi.recruiters();
    expect(r.data?.items).toHaveLength(2);
  });
  it("recruiters conserva ai_replies cuando el servidor lo manda (JB-92)", async () => {
    stubFetch(() => jsonRes(200, { ...items(RECRUITERS), ai_replies: true }));
    expect((await interviewsApi.recruiters()).data?.ai_replies).toBe(true);
  });
  it("list sin parámetros -> GET /api/interviews", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([RESUMEN()], "sig")));
    const r = await interviewsApi.list();
    expect(llamadas[0].url).toBe("/api/interviews");
    expect(r.data).toEqual(pagina([RESUMEN()], "sig"));
  });
  it("list con limit, cursor y status los envía codificados", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, pagina([])));
    await interviewsApi.list({ limit: 20, cursor: "a+b/c=", status: "completed" });
    expect(llamadas[0].url).toBe("/api/interviews?limit=20&cursor=a%2Bb%2Fc%3D&status=completed");
    await interviewsApi.list({ status: "in_progress" });
    expect(llamadas[1].url).toBe("/api/interviews?status=in_progress");
  });
});

describe("el límite de 4000 cuenta caracteres Unicode, no unidades UTF-16", () => {
  it("countChars cuenta puntos de código", () => {
    expect(countChars("abc")).toBe(3);
    expect(countChars("😀".repeat(10))).toBe(10);
    expect("😀".repeat(10).length).toBe(20);
    expect(countChars("ñ")).toBe(1);
  });
});

describe("fechas en es-GT", () => {
  it("la renovación es una fecha UTC, sin correrse al día anterior por la zona horaria local", () => {
    process.env.TZ = "America/Guatemala";
    expect(formatRenewal("2026-12-01T00:00:00Z")).toBe("1 de diciembre de 2026");
    expect(formatRenewal("2027-01-01T00:00:00Z")).toBe("1 de enero de 2027");
  });
  it("una fecha inválida no produce texto roto", () => {
    expect(formatRenewal("no es fecha")).toBeNull();
    expect(formatDate("no es fecha")).toBe("");
  });
});

describe("interviewErrorText: mensaje final con fecha de renovación y espera", () => {
  it("limite_del_plan con renews_at muestra la fecha; sin ella, el mensaje sin fecha", () => {
    process.env.TZ = "America/Guatemala";
    const con = interviewErrorText({ status: 403, error: "limite_del_plan", renewsAt: "2026-12-01T00:00:00Z" });
    expect(con).toBe(tf("interview.error.planLimitRenews", { date: "1 de diciembre de 2026" }));
    expect(con).toContain("1 de diciembre de 2026");
    expect(interviewErrorText({ status: 403, error: "limite_del_plan", renewsAt: null })).toBe(t("interview.error.planLimit"));
    expect(interviewErrorText({ status: 403, error: "limite_del_plan", renewsAt: "basura" })).toBe(t("interview.error.planLimit"));
  });
  it("demasiados_intentos con Retry-After dice cuántos segundos esperar", () => {
    expect(interviewErrorText({ status: 429, error: "demasiados_intentos", retryAfter: 17 })).toBe(tf("interview.error.rateLimitedIn", { n: 17 }));
    expect(interviewErrorText({ status: 429, error: "demasiados_intentos", retryAfter: null })).toBe(t("interview.error.rateLimited"));
  });
  it("el resto cae al mensaje por código", () => {
    expect(interviewErrorText({ status: 409, error: "estado_invalido" })).toBe(t("interview.error.state"));
  });
});

describe("F13 errores en español, sin texto técnico", () => {
  const casos: [number, string | null, string][] = [
    [403, "nivel_bloqueado", "interview.error.levelLocked"],
    [403, "cuenta_no_disponible", "interview.error.forbidden"],
    [403, "limite_del_plan", "interview.error.planLimit"],
    [409, "nivel_no_disponible", "interview.error.levelUnavailable"],
    [409, "sesion_en_curso", "interview.error.activeSession"],
    [409, "turno_en_proceso", "interview.error.turnInProgress"],
    [409, "estado_invalido", "interview.error.state"],
    [422, "entrevista_muy_corta", "interview.error.tooShort"],
    [422, "datos_invalidos", "interview.error.invalid"],
    [422, null, "interview.error.invalid"],
    [429, "demasiados_intentos", "interview.error.rateLimited"],
    [503, "motor_no_disponible", "interview.error.engineDown"],
    [404, "no_encontrado", "interview.error.notFound"],
    [0, null, "interview.error.generic"],
    [502, "servicio_no_disponible", "interview.error.generic"],
    [500, null, "interview.error.generic"],
  ];
  for (const [estado, codigo, clave] of casos) {
    it(`${estado} ${codigo ?? "(sin código)"} -> ${clave}`, () => {
      expect(interviewErrorKey(estado, codigo)).toBe(clave);
    });
  }
  it("ningún mensaje de error muestra códigos, estados HTTP ni jerga técnica", () => {
    const tecnico = /\b(40[0-9]|42[0-9]|50[0-9]|http|json|api|nivel_bloqueado|sesion_en_curso|turno_en_proceso|nivel_no_disponible|stack|exception|null|undefined|status)\b|_/i;
    for (const [k, v] of Object.entries(es)) {
      if (k.startsWith("interview.error.")) expect(v, k).not.toMatch(tecnico);
    }
  });
});

describe("tf: textos con valores", () => {
  it("reemplaza {nombre} por su valor", () => {
    expect(tf("progress.evolution.up", { n: 12 })).toContain("12");
    expect(tf("progress.evolution.up", { n: 12 })).not.toContain("{");
  });
  it("lanza si falta un valor", () => {
    expect(() => tf("progress.evolution.up", {})).toThrow(/n/);
  });
  it("t() sigue devolviendo la plantilla sin tocarla", () => {
    expect(t("progress.evolution.up")).toContain("{n}");
  });
});
