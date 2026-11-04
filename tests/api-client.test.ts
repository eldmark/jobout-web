/** F3 y F4: cliente de API con Bearer y un solo refresh. fetch simulado. */
import { describe, it, expect, vi } from "vitest";
import { createApiClient, REFRESH_PATH, ME_PATH } from "@/lib/api/client";

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function montar(respuestas: Response[], token: string | null = "tok1") {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
    const r = respuestas.shift();
    if (!r) throw new Error("fetch sin respuesta preparada");
    return r;
  });
  const onSessionExpired = vi.fn();
  const cliente = createApiClient({
    baseUrl: "http://api.test",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getAccessToken: () => token ?? undefined,
    onSessionExpired,
  });
  return { cliente, fetchImpl, onSessionExpired };
}

const cabecera = (fetchImpl: ReturnType<typeof vi.fn>, n: number, h: string) =>
  new Headers((fetchImpl.mock.calls[n] as unknown as [string, RequestInit])[1].headers).get(h);

describe("constantes de endpoints", () => {
  it("apuntan a /api/v1", () => {
    expect(REFRESH_PATH).toBe("/api/v1/auth/refresh");
    expect(ME_PATH).toBe("/api/v1/me");
  });
});

describe("F3 Authorization Bearer", () => {
  it("envía Bearer en llamadas autenticadas", async () => {
    const { cliente, fetchImpl } = montar([json(200, { name: "Ana" })]);
    const res = await cliente.request(ME_PATH);
    expect(res.status).toBe(200);
    expect(fetchImpl.mock.calls[0][0]).toBe("http://api.test/api/v1/me");
    expect(cabecera(fetchImpl, 0, "authorization")).toBe("Bearer tok1");
  });
  it("sin token no inventa la cabecera", async () => {
    const { cliente, fetchImpl } = montar([json(200)], null);
    await cliente.request(ME_PATH);
    expect(cabecera(fetchImpl, 0, "authorization")).toBeNull();
  });
});

describe("F4 401 -> un refresh -> repetir", () => {
  it("refresca una vez y repite con el token nuevo", async () => {
    const { cliente, fetchImpl, onSessionExpired } = montar([
      json(401),
      json(200, { access_token: "tok2" }),
      json(200, { name: "Ana" }),
    ]);
    const res = await cliente.request(ME_PATH);
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe("http://api.test/api/v1/auth/refresh");
    expect((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].method).toBe("POST");
    expect(cabecera(fetchImpl, 2, "authorization")).toBe("Bearer tok2");
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
  it("si el refresh falla, lleva a /sign-in y no repite", async () => {
    const { cliente, fetchImpl, onSessionExpired } = montar([json(401), json(401)]);
    await expect(cliente.request(ME_PATH)).rejects.toThrow(/sesión/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
  it("si la repetición vuelve a dar 401, no hace un segundo refresh", async () => {
    const { cliente, fetchImpl, onSessionExpired } = montar([
      json(401),
      json(200, { access_token: "tok2" }),
      json(401),
    ]);
    await expect(cliente.request(ME_PATH)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
  it("una llamada al propio refresh que da 401 no entra en bucle", async () => {
    const { cliente, fetchImpl } = montar([json(401)]);
    const res = await cliente.request(REFRESH_PATH, { method: "POST", auth: false });
    expect(res.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("401s concurrentes comparten un único refresh", async () => {
    const { cliente, fetchImpl } = montar([
      json(401),
      json(401),
      json(200, { access_token: "tok2" }),
      json(200),
      json(200),
    ]);
    await Promise.all([cliente.request("/api/v1/a"), cliente.request("/api/v1/b")]);
    const refreshes = fetchImpl.mock.calls.filter((c) => String(c[0]).endsWith(REFRESH_PATH));
    expect(refreshes).toHaveLength(1);
  });
  it("otros errores (500) se devuelven tal cual, sin refresh", async () => {
    const { cliente, fetchImpl } = montar([json(500)]);
    expect((await cliente.request(ME_PATH)).status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("refresh personalizado (servidor)", () => {
  it("usa refreshToken() en lugar del refresh por cookie y repite con el token nuevo", async () => {
    const vistos: (string | null)[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const auth = new Headers(init.headers).get("authorization");
      vistos.push(auth);
      return new Response(null, { status: auth === "Bearer nuevo" ? 204 : 401 });
    }) as unknown as typeof fetch;
    const refreshToken = vi.fn(async () => "nuevo");
    const c = createApiClient({ baseUrl: "http://x", fetchImpl, getAccessToken: () => "viejo", refreshToken });
    const res = await c.request("/api/v1/me");
    expect(res.status).toBe(204);
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(vistos).toEqual(["Bearer viejo", "Bearer nuevo"]);
  });
  it("si refreshToken() devuelve undefined, sesión expirada", async () => {
    const fetchImpl = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
    const onSessionExpired = vi.fn();
    const c = createApiClient({ baseUrl: "http://x", fetchImpl, refreshToken: async () => undefined, onSessionExpired });
    await expect(c.request("/api/v1/me")).rejects.toThrow();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
