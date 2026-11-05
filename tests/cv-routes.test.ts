// @vitest-environment node
/** Capa servidor de CV, perfil y catálogos (F9, F11 y reenvío seguro). Backend simulado con fetch. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { jsonRes, stubFetch, TOKENS } from "./helpers/backend";
import * as cvs from "@/app/api/cvs/route";
import * as cvFile from "@/app/api/cvs/[id]/file/route";
import * as cvPrimary from "@/app/api/cvs/[id]/primary/route";
import * as cvOne from "@/app/api/cvs/[id]/route";
import * as extraction from "@/app/api/cvs/[id]/extraction/route";
import * as confirm from "@/app/api/cvs/[id]/extraction/confirm/route";
import * as profile from "@/app/api/profile/route";
import * as catalogs from "@/app/api/catalogs/[nombre]/route";

const ID = "11111111-1111-4111-8111-111111111111";
const COOKIE = "jo_session=acc-111; jo_refresh=ref-222";
const params = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

function conArchivo(nombre: string, tipo: string, bytes: number | Uint8Array, cookie: string | null = COOKIE) {
  const fd = new FormData();
  const data = typeof bytes === "number" ? new Uint8Array(bytes) : bytes;
  fd.set("file", new File([data as BlobPart], nombre, { type: tipo }));
  return new Request("http://localhost/api/cvs", { method: "POST", body: fd, headers: cookie ? { cookie } : {} });
}
const get = (url: string, cookie: string | null = COOKIE) =>
  new Request(`http://localhost${url}`, { headers: cookie ? { cookie } : {} });
const send = (url: string, method: string, body?: unknown, cookie: string | null = COOKIE) =>
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

const CREADO = { id: ID, version: 1, is_primary: true, original_filename: "cv.pdf", size_bytes: 10, created_at: "2026-11-05T10:00:00Z", extraction: { status: "ready", reason: null, proposal: { description: null, skills: [], languages: [], experiences: [] } } };

describe("POST /api/cvs", () => {
  it("reenvía el multipart al backend con Bearer y devuelve el cuerpo sin tokens", async () => {
    const { llamadas, fn } = stubFetch(() => jsonRes(201, CREADO));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 100));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(CREADO);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(llamadas[0].url).toBe("http://core-api:8080/api/v1/cvs");
    expect(llamadas[0].method).toBe("POST");
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect(((init.body as FormData).get("file") as File).name).toBe("cv.pdf");
    expect(new Headers(init.headers).get("content-type")).toBeNull();
  });
  it("acepta DOCX", async () => {
    stubFetch(() => jsonRes(201, CREADO));
    const tipo = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect((await cvs.POST(conArchivo("cv.docx", tipo, 100))).status).toBe(201);
  });
  it("sin sesión: 401 y no llama al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, CREADO));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10, null));
    expect(res.status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
  it("más de 5 MB: 413 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, CREADO));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 5 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("archivo_demasiado_grande");
    expect(fn).not.toHaveBeenCalled();
  });
  it("exactamente 5 MB sí pasa", async () => {
    stubFetch(() => jsonRes(201, CREADO));
    expect((await cvs.POST(conArchivo("cv.pdf", "application/pdf", 5 * 1024 * 1024))).status).toBe(201);
  });
  it("tipo no permitido: 415 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, CREADO));
    const res = await cvs.POST(conArchivo("foto.png", "image/png", 10));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe("tipo_no_permitido");
    expect(fn).not.toHaveBeenCalled();
  });
  it("cuerpo sin campo file: 422", async () => {
    const { fn } = stubFetch(() => jsonRes(201, CREADO));
    const fd = new FormData();
    fd.set("otro", "x");
    const res = await cvs.POST(new Request("http://localhost/api/cvs", { method: "POST", body: fd, headers: { cookie: COOKIE } }));
    expect(res.status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("cuerpo que no es multipart: 422", async () => {
    stubFetch(() => jsonRes(201, CREADO));
    expect((await cvs.POST(send("/api/cvs", "POST", { a: 1 }))).status).toBe(422);
  });
  it.each([
    [409, "limite_de_cvs"],
    [413, "archivo_demasiado_grande"],
    [415, "tipo_no_permitido"],
    [422, "datos_invalidos"],
  ])("reenvía el error documentado %i %s", async (status, error) => {
    stubFetch(() => jsonRes(status, { error, message: "texto interno del backend" }));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10));
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body).toEqual({ error });
  });
  it("código no documentado o 500: 502 genérico sin detalles", async () => {
    stubFetch(() => jsonRes(500, { error: "error_interno", message: "stack trace secreto" }));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10));
    expect(res.status).toBe(502);
    const texto = JSON.stringify(await res.json());
    expect(texto).toBe(JSON.stringify({ error: "servicio_no_disponible" }));
  });
  it("409 con un código que no es del contrato: 502", async () => {
    stubFetch(() => jsonRes(409, { error: "algo_raro" }));
    expect((await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10))).status).toBe(502);
  });
  it("backend caído: 502", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect((await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10))).status).toBe(502);
  });
  it("201 con cuerpo que no es JSON: 502", async () => {
    stubFetch(() => new Response("<html>", { status: 201 }));
    expect((await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10))).status).toBe(502);
  });
  it("si el access expiró renueva una vez, reintenta y escribe las cookies nuevas", async () => {
    let n = 0;
    const { llamadas } = stubFetch((c) => {
      if (c.url.endsWith("/auth/refresh")) return jsonRes(200, { ...TOKENS, access_token: "acc-nuevo", refresh_token: "ref-nuevo" });
      return n++ === 0 ? jsonRes(401, { error: "token_invalido" }) : jsonRes(201, CREADO);
    });
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10));
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("jo_session=acc-nuevo");
    expect(llamadas.filter((c) => c.url.endsWith("/cvs"))).toHaveLength(2);
  });
  it("sesión irrecuperable: 401 y cookies borradas", async () => {
    stubFetch((c) => (c.url.endsWith("/auth/refresh") ? jsonRes(401) : jsonRes(401, { error: "token_invalido" })));
    const res = await cvs.POST(conArchivo("cv.pdf", "application/pdf", 10));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("GET /api/cvs", () => {
  it("lista los CVs con Bearer", async () => {
    const lista = [{ id: ID, version: 1, is_primary: true, original_filename: "cv.pdf", size_bytes: 10, created_at: "x" }];
    const { llamadas } = stubFetch(() => jsonRes(200, lista));
    const res = await cvs.GET(get("/api/cvs"));
    expect(await res.json()).toEqual(lista);
    expect(llamadas[0].url).toBe("http://core-api:8080/api/v1/cvs");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("sin sesión: 401", async () => {
    const { fn } = stubFetch(() => jsonRes(200, []));
    expect((await cvs.GET(get("/api/cvs", null))).status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("F11 descarga por la capa servidor", () => {
  it("entrega los bytes con attachment y nosniff, sin exponer token ni rutas del almacén", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    const { llamadas } = stubFetch(
      () => new Response(bytes, { status: 200, headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="cv.pdf"', "x-content-type-options": "nosniff" } }),
    );
    const res = await cvFile.GET(get(`/api/cvs/${ID}/file`), params({ id: ID }));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(llamadas[0].url).toBe(`http://core-api:8080/api/v1/cvs/${ID}/file`);
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
    const todas = JSON.stringify([...res.headers.entries()]);
    expect(todas).not.toContain("acc-111");
    expect(todas).not.toContain("core-api");
  });
  it("aunque el backend no mande cabeceras, fuerza attachment y nosniff", async () => {
    stubFetch(() => new Response(new Uint8Array([1]), { status: 200 }));
    const res = await cvFile.GET(get(`/api/cvs/${ID}/file`), params({ id: ID }));
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("id con formato inválido: 404 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => new Response("x"));
    const res = await cvFile.GET(get("/api/cvs/../file"), params({ id: "../../etc/passwd" }));
    expect(res.status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("ajeno o inexistente: 404", async () => {
    stubFetch(() => jsonRes(404, { error: "no_encontrado" }));
    const res = await cvFile.GET(get(`/api/cvs/${ID}/file`), params({ id: ID }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_encontrado" });
  });
});

describe("primario, borrado y extracción", () => {
  it("PUT primary -> 204", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await cvPrimary.PUT(send(`/api/cvs/${ID}/primary`, "PUT"), params({ id: ID }));
    expect(res.status).toBe(204);
    expect(llamadas[0]).toMatchObject({ url: `http://core-api:8080/api/v1/cvs/${ID}/primary`, method: "PUT" });
  });
  it("DELETE -> 204 y 404 si no existe", async () => {
    stubFetch(() => jsonRes(204));
    expect((await cvOne.DELETE(send(`/api/cvs/${ID}`, "DELETE"), params({ id: ID }))).status).toBe(204);
    stubFetch(() => jsonRes(404, { error: "no_encontrado" }));
    expect((await cvOne.DELETE(send(`/api/cvs/${ID}`, "DELETE"), params({ id: ID }))).status).toBe(404);
  });
  it("id inválido en primary y delete: 404 sin backend", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    expect((await cvPrimary.PUT(send("/api/cvs/x/primary", "PUT"), params({ id: "x" }))).status).toBe(404);
    expect((await cvOne.DELETE(send("/api/cvs/x", "DELETE"), params({ id: "x" }))).status).toBe(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it("GET extraction reenvía el objeto", async () => {
    const cuerpo = { status: "failed", reason: "sin_texto", proposal: null, reviewed: false };
    stubFetch(() => jsonRes(200, cuerpo));
    const res = await extraction.GET(get(`/api/cvs/${ID}/extraction`), params({ id: ID }));
    expect(await res.json()).toEqual(cuerpo);
  });
  it("POST confirm reenvía el JSON editado y devuelve 204", async () => {
    const cuerpo = { description: "hola", skills: [], languages: [], experiences: [] };
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await confirm.POST(send(`/api/cvs/${ID}/extraction/confirm`, "POST", cuerpo), params({ id: ID }));
    expect(res.status).toBe(204);
    expect(llamadas[0].body).toEqual(cuerpo);
    expect(llamadas[0].url).toBe(`http://core-api:8080/api/v1/cvs/${ID}/extraction/confirm`);
  });
  it("confirm con cuerpo inválido: 422 sin backend; 422 del backend se reenvía", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    const malo = new Request("http://localhost/x", { method: "POST", headers: { cookie: COOKIE }, body: "no json" });
    expect((await confirm.POST(malo, params({ id: ID }))).status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
    stubFetch(() => jsonRes(422, { error: "datos_invalidos", message: "skills[0].skill_id" }));
    const res = await confirm.POST(send("/x", "POST", { skills: [] }), params({ id: ID }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "datos_invalidos" });
  });
});

describe("perfil y catálogos", () => {
  it("GET /api/profile", async () => {
    const vacio = { description: null, phone: null, academic_level_id: null, profession_id: null, job_hierarchy_id: null, skills: [], languages: [], experiences: [], extra_knowledge: null };
    const { llamadas } = stubFetch(() => jsonRes(200, vacio));
    const res = await profile.GET(get("/api/profile"));
    expect(await res.json()).toEqual(vacio);
    expect(llamadas[0].url).toBe("http://core-api:8080/api/v1/profile");
  });
  it("PUT /api/profile reenvía el cuerpo y responde 204; 422 se reenvía", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await profile.PUT(send("/api/profile", "PUT", { phone: "+57 300" }));
    expect(res.status).toBe(204);
    expect(llamadas[0]).toMatchObject({ method: "PUT", body: { phone: "+57 300" } });
    stubFetch(() => jsonRes(422, { error: "datos_invalidos" }));
    expect((await profile.PUT(send("/api/profile", "PUT", { phone: "x" }))).status).toBe(422);
  });
  it("catálogos conocidos pasan y desconocidos dan 404 sin backend", async () => {
    const { llamadas, fn } = stubFetch(() => jsonRes(200, [{ id: ID, code: "rust", name: "Rust" }]));
    for (const n of ["skills", "languages", "academic-levels", "professions", "job-hierarchies"]) {
      expect((await catalogs.GET(get(`/api/catalogs/${n}`), params({ nombre: n }))).status).toBe(200);
    }
    expect(llamadas[0].url).toBe("http://core-api:8080/api/v1/catalogs/skills");
    fn.mockClear();
    for (const n of ["otra-cosa", "../me", "skills/../x"]) {
      expect((await catalogs.GET(get("/api/catalogs/x"), params({ nombre: n }))).status).toBe(404);
    }
    expect(fn).not.toHaveBeenCalled();
  });
});
