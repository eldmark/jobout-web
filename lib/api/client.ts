/**
 * F3/F4: cliente de la API. Añade Authorization: Bearer; ante un 401 hace UN refresh
 * (compartido entre llamadas concurrentes) y repite una vez; si falla, sesión expirada.
 * El token vive en memoria o lo entrega `getAccessToken`; nunca en almacenamiento del navegador.
 * Los endpoints del backend aún no existen: el contrato del refresh (`{ access_token }`)
 * es una suposición a confirmar.
 */
export const REFRESH_PATH = "/api/v1/auth/refresh";
export const ME_PATH = "/api/v1/me";

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | undefined;
  /** Se llama una vez cuando no se pudo recuperar la sesión. Por defecto, ir a /sign-in. */
  onSessionExpired?: () => void;
}

export interface RequestOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
  /** false = no añade Bearer ni intenta refresh (p. ej. el propio refresh). */
  auth?: boolean;
}

export class SessionExpiredError extends Error {
  constructor() {
    super("La sesión expiró");
    this.name = "SessionExpiredError";
  }
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let memoryToken: string | undefined;
  let refreshing: Promise<boolean> | null = null;

  const token = () => memoryToken ?? options.getAccessToken?.();
  const expire = () => {
    if (options.onSessionExpired) options.onSessionExpired();
    else if (typeof window !== "undefined") window.location.assign("/sign-in");
  };

  const send = (path: string, init: RequestOptions) => {
    const { auth = true, headers, ...rest } = init;
    const h = new Headers(headers);
    const tk = auth ? token() : undefined;
    if (tk) h.set("Authorization", `Bearer ${tk}`);
    return doFetch(`${options.baseUrl}${path}`, { credentials: "include", ...rest, headers: h });
  };

  const refresh = (): Promise<boolean> => {
    refreshing ??= (async () => {
      try {
        const res = await send(REFRESH_PATH, { method: "POST", auth: false });
        if (!res.ok) return false;
        const body = (await res.json()) as { access_token?: string };
        if (!body.access_token) return false;
        memoryToken = body.access_token;
        return true;
      } catch {
        return false;
      } finally {
        queueMicrotask(() => {
          refreshing = null;
        });
      }
    })();
    return refreshing;
  };

  async function request(path: string, init: RequestOptions = {}): Promise<Response> {
    const res = await send(path, init);
    if (res.status !== 401 || init.auth === false) return res;

    if (!(await refresh())) {
      expire();
      throw new SessionExpiredError();
    }
    const retry = await send(path, init);
    if (retry.status === 401) {
      expire();
      throw new SessionExpiredError();
    }
    return retry;
  }

  return { request };
}
