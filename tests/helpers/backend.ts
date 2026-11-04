import { vi } from "vitest";

export const TOKENS = {
  access_token: "acc-111",
  refresh_token: "ref-222",
  token_type: "Bearer",
  expires_in: 900,
};

export function jsonRes(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export type Llamada = { url: string; method: string; headers: Headers; body: unknown };

/** Sustituye fetch global. `rutas` se evalúa en orden; devuelve respuestas por cada llamada. */
export function stubFetch(handler: (c: Llamada) => Response | Promise<Response>) {
  const llamadas: Llamada[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    let body: unknown = undefined;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const c: Llamada = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      headers: new Headers(init?.headers),
      body,
    };
    llamadas.push(c);
    return handler(c);
  });
  vi.stubGlobal("fetch", fn);
  return { fn, llamadas };
}

export function req(
  url: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  return new Request(`http://localhost${url}`, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
