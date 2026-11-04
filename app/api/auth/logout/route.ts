import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import { API_PREFIX, backendUrl, clearSessionCookies, readCookie } from "@/lib/auth/server";

export async function POST(request: Request): Promise<Response> {
  const refresh = readCookie(request, REFRESH_COOKIE);
  if (refresh) {
    try {
      await fetch(`${backendUrl()}${API_PREFIX}/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
    } catch {
      // Aunque el backend no responda, la sesión del navegador se cierra.
    }
  }
  const h = new Headers({ "cache-control": "no-store" });
  clearSessionCookies(h);
  return new Response(null, { status: 204, headers: h });
}
