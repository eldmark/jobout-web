/** Cliente tipado del contrato simulado + F13 (errores en español, sin texto técnico). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { jsonRes, stubFetch } from "./helpers/backend";
import { SID, SESION, SCORE, REC_ID, LVL_ID } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { es } from "@/lib/messages/es";
import { goTo } from "@/lib/navigate";
import { interviewsApi } from "@/lib/interviews/client";
import { interviewErrorKey } from "@/lib/interviews/errors";

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

describe("F13 errores en español, sin texto técnico", () => {
  const casos: [number, string | null, string][] = [
    [403, "nivel_bloqueado", "interview.error.levelLocked"],
    [403, "cuenta_no_disponible", "interview.error.forbidden"],
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
