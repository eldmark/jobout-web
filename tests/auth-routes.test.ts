/** F5 + capa servidor: los tokens solo viajan servidor <-> backend y a cookies HttpOnly. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { jsonRes, req, stubFetch, TOKENS } from "./helpers/backend";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as refresh } from "@/app/api/auth/refresh/route";
import { DELETE as borrarCuenta } from "@/app/api/account/route";
import { isPublicPath } from "@/lib/auth/route-guard";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

const BASE = "http://core-api:8080";
const OK_REG = { email: "ana@mail.com", password: "una-clave-larga", first_name: "Ana", last_name: "Paz" };

beforeEach(() => {
  vi.stubEnv("API_URL_INTERNA", BASE);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const cookies = (r: Response) => r.headers.getSetCookie();
const cookie = (r: Response, n: string) => cookies(r).find((c) => c.startsWith(`${n}=`));

describe("POST /api/auth/register", () => {
  it("201 del backend: guarda tokens en cookies HttpOnly/Secure/Lax y NO los devuelve en el cuerpo", async () => {
    const { llamadas } = stubFetch(() => jsonRes(201, TOKENS));
    const res = await register(req("/api/auth/register", { body: OK_REG }));
    expect(res.status).toBe(200);
    expect(llamadas[0]).toMatchObject({ url: `${BASE}/api/v1/auth/register`, method: "POST", body: OK_REG });
    for (const n of ["jo_session", "jo_refresh"]) {
      const c = cookie(res, n)!;
      expect(c).toMatch(/HttpOnly/);
      expect(c).toMatch(/Secure/);
      expect(c).toMatch(/SameSite=Lax/);
    }
    expect(cookie(res, "jo_session")).toContain("acc-111");
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=900/);
    expect(cookie(res, "jo_refresh")).toContain("ref-222");
    const texto = await res.text();
    expect(texto).not.toContain("acc-111");
    expect(texto).not.toContain("ref-222");
  });
  it("contraseña corta: 422 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(201, TOKENS));
    const res = await register(req("/api/auth/register", { body: { ...OK_REG, password: "corta" } }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "datos_invalidos" });
    expect(fn).not.toHaveBeenCalled();
  });
  it("cuerpo que no es JSON: 422", async () => {
    stubFetch(() => jsonRes(201, TOKENS));
    const r = new Request("http://localhost/api/auth/register", { method: "POST", body: "no-json" });
    expect((await register(r)).status).toBe(422);
  });
  it("409 -> 409 registro_no_disponible, sin cookies", async () => {
    stubFetch(() => jsonRes(409, { error: "registro_no_disponible" }));
    const res = await register(req("/api/auth/register", { body: OK_REG }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "registro_no_disponible" });
    expect(cookies(res)).toEqual([]);
  });
  it("backend caído: 502 genérico, sin filtrar detalles", async () => {
    stubFetch(() => {
      throw new Error("ECONNREFUSED core-api:8080");
    });
    const res = await register(req("/api/auth/register", { body: OK_REG }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("ECONNREFUSED");
  });
});

describe("POST /api/auth/login", () => {
  const body = { email: "ana@mail.com", password: "una-clave-larga" };
  it("200: cookies de sesión y refresh", async () => {
    stubFetch(() => jsonRes(200, TOKENS));
    const res = await login(req("/api/auth/login", { body }));
    expect(res.status).toBe(200);
    expect(cookie(res, "jo_session")).toContain("acc-111");
    expect(cookie(res, "jo_refresh")).toContain("ref-222");
  });
  it.each([
    [401, "credenciales_invalidas"],
    [403, "cuenta_no_disponible"],
    [429, "demasiados_intentos"],
  ])("%i se traduce al mismo código y no crea cookies", async (status, error) => {
    stubFetch(() => jsonRes(status, { error }));
    const res = await login(req("/api/auth/login", { body }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
    expect(cookies(res)).toEqual([]);
  });
  it("un código desconocido del backend no se reenvía tal cual", async () => {
    stubFetch(() => jsonRes(500, { error: "stack: panic en auth.rs:42" }));
    const res = await login(req("/api/auth/login", { body }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("panic");
  });
  it("sin email o contraseña: 422 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(200, TOKENS));
    const res = await login(req("/api/auth/login", { body: { email: "", password: "" } }));
    expect(res.status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("llama a /logout con el refresh token y borra ambas cookies", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await logout(req("/api/auth/logout", { cookie: "jo_session=acc-111; jo_refresh=ref-222" }));
    expect(res.status).toBe(204);
    expect(llamadas[0]).toMatchObject({ url: `${BASE}/api/v1/auth/logout`, body: { refresh_token: "ref-222" } });
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=0/);
    expect(cookie(res, "jo_refresh")).toMatch(/Max-Age=0/);
  });
  it("aunque el backend falle, las cookies se borran", async () => {
    stubFetch(() => jsonRes(500));
    const res = await logout(req("/api/auth/logout", { cookie: "jo_refresh=ref-222" }));
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=0/);
    expect(cookie(res, "jo_refresh")).toMatch(/Max-Age=0/);
  });
  it("sin refresh token no llama al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    await logout(req("/api/auth/logout", { cookie: "jo_session=acc-111" }));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/refresh (refresco transparente desde páginas)", () => {
  it("renueva cookies y vuelve a /dashboard", async () => {
    const nuevos = { ...TOKENS, access_token: "acc-nuevo", refresh_token: "ref-nuevo" };
    const { llamadas } = stubFetch(() => jsonRes(200, nuevos));
    const res = await refresh(req("/api/auth/refresh", { method: "GET", cookie: "jo_refresh=ref-222" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    expect(llamadas[0]).toMatchObject({ url: `${BASE}/api/v1/auth/refresh`, body: { refresh_token: "ref-222" } });
    expect(cookie(res, "jo_session")).toContain("acc-nuevo");
    expect(cookie(res, "jo_refresh")).toContain("ref-nuevo");
  });
  it("si el refresh falla borra cookies y lleva a /sign-in", async () => {
    stubFetch(() => jsonRes(401, { error: "token_invalido" }));
    const res = await refresh(req("/api/auth/refresh", { method: "GET", cookie: "jo_refresh=viejo" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=0/);
    expect(cookie(res, "jo_refresh")).toMatch(/Max-Age=0/);
  });
  it("sin cookie de refresh va directo a /sign-in", async () => {
    const { fn } = stubFetch(() => jsonRes(200, TOKENS));
    const res = await refresh(req("/api/auth/refresh", { method: "GET" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
    expect(fn).not.toHaveBeenCalled();
  });
  it("?fail=1 (el refresh no arregló la sesión) borra cookies sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(200, TOKENS));
    const res = await refresh(req("/api/auth/refresh?fail=1", { method: "GET", cookie: "jo_refresh=ref-222" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
    expect(cookie(res, "jo_refresh")).toMatch(/Max-Age=0/);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/account", () => {
  const C = "jo_session=acc-111; jo_refresh=ref-222";
  it("llama a DELETE /me con Bearer y la contraseña; 204 borra cookies", async () => {
    const { llamadas } = stubFetch(() => jsonRes(204));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: { password: "una-clave-larga" } }));
    expect(res.status).toBe(204);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatchObject({ url: `${BASE}/api/v1/me`, method: "DELETE", body: { password: "una-clave-larga" } });
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=0/);
    expect(cookie(res, "jo_refresh")).toMatch(/Max-Age=0/);
  });
  it("403 (contraseña incorrecta): se reenvía y la sesión NO se cierra", async () => {
    stubFetch(() => jsonRes(403, { error: "contrasena_incorrecta" }));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: { password: "mala-mala-mala" } }));
    expect(res.status).toBe(403);
    expect(cookies(res)).toEqual([]);
  });
  it("sin contraseña: 422 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: {} }));
    expect(res.status).toBe(422);
    expect(fn).not.toHaveBeenCalled();
  });
  it("sin sesión: 401 sin llamar al backend", async () => {
    const { fn } = stubFetch(() => jsonRes(204));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", body: { password: "x".repeat(12) } }));
    expect(res.status).toBe(401);
    expect(fn).not.toHaveBeenCalled();
  });
  it("access expirado: UN refresh, repite con el token nuevo y borra la cuenta", async () => {
    let n = 0;
    const { llamadas } = stubFetch((c) => {
      if (c.url.endsWith("/auth/refresh")) return jsonRes(200, { ...TOKENS, access_token: "acc-nuevo", refresh_token: "ref-nuevo" });
      return n++ === 0 ? jsonRes(401, { error: "token_invalido" }) : jsonRes(204);
    });
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: { password: "una-clave-larga" } }));
    expect(res.status).toBe(204);
    expect(llamadas.map((l) => l.url.replace(BASE, ""))).toEqual(["/api/v1/me", "/api/v1/auth/refresh", "/api/v1/me"]);
    expect(llamadas[2].headers.get("authorization")).toBe("Bearer acc-nuevo");
  });
  it("401 y el refresh también falla: 401 y cookies borradas", async () => {
    stubFetch((c) => jsonRes(401, { error: c.url }));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: { password: "una-clave-larga" } }));
    expect(res.status).toBe(401);
    expect(cookie(res, "jo_session")).toMatch(/Max-Age=0/);
  });
  it("500 del backend: 502 y la sesión sigue", async () => {
    stubFetch(() => jsonRes(500));
    const res = await borrarCuenta(req("/api/account", { method: "DELETE", cookie: C, body: { password: "una-clave-larga" } }));
    expect(res.status).toBe(502);
    expect(cookies(res)).toEqual([]);
  });
});

describe("acceso a rutas de auth y despedida", () => {
  it.each(["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/refresh", "/adios"])(
    "%s es público (no exige jo_session)",
    (p) => expect(isPublicPath(p)).toBe(true),
  );
  it("/api/account sigue protegida", () => expect(isPublicPath("/api/account")).toBe(false));
  it("con solo la cookie de refresh, /dashboard pasa (el refresco la renueva)", () => {
    const r = middleware(new NextRequest("http://localhost/dashboard", { headers: { cookie: "jo_refresh=ref-222" } }));
    expect(r.headers.get("location")).toBeNull();
  });
});
