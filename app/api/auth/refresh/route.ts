import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import { SIGN_IN_PATH } from "@/lib/auth/route-guard";
import { clearSessionCookies, readCookie, refreshTokens, setTokenCookies } from "@/lib/auth/server";

/** Refresco transparente: las páginas del servidor no pueden escribir cookies, así que
 * redirigen aquí, se renuevan los tokens y se vuelve a /dashboard. `?fail=1` cierra la sesión. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const refresh = readCookie(request, REFRESH_COOKIE);
  const tokens = refresh && url.searchParams.get("fail") !== "1" ? await refreshTokens(refresh) : null;

  const h = new Headers({ "cache-control": "no-store" });
  if (!tokens) {
    clearSessionCookies(h);
    h.set("location", new URL(SIGN_IN_PATH, url).toString());
  } else {
    setTokenCookies(h, tokens);
    h.set("location", new URL("/dashboard?refreshed=1", url).toString());
  }
  return new Response(null, { status: 307, headers: h });
}
