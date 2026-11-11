import { ME_PATH, SessionExpiredError } from "@/lib/api/client";
import {
  authedBackend,
  clearSessionCookies,
  errorJson,
  readJson,
  setTokenCookies,
} from "@/lib/auth/server";

/** Borrado de cuenta (HU-05). 204 -> cookies fuera. Cualquier otro caso NO cierra la sesión. */
export async function DELETE(request: Request): Promise<Response> {
  const b = await readJson(request);
  if (!b || typeof b.password !== "string" || !b.password) return errorJson(422, "datos_invalidos");

  const api = authedBackend(request);
  if (!api.hasSession) return errorJson(401, "sesion_expirada");

  let res: Response;
  try {
    res = await api.request(ME_PATH, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: b.password }),
    });
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      const h = new Headers();
      clearSessionCookies(h);
      return errorJson(401, "sesion_expirada", h);
    }
    return errorJson(502, "servicio_no_disponible");
  }

  const h = new Headers({ "cache-control": "no-store" });
  if (res.status === 204) {
    clearSessionCookies(h);
    return new Response(null, { status: 204, headers: h });
  }
  if (api.rotated) setTokenCookies(h, api.rotated);
  if (res.status === 403) return errorJson(403, "contrasena_incorrecta", h);
  if (res.status === 409) {
    // Único administrador de la empresa: no se borra nada y la persona debe saber por qué.
    const cuerpo = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (cuerpo?.error === "ultimo_administrador") return errorJson(409, "ultimo_administrador", h);
  }
  return errorJson(502, "servicio_no_disponible", h);
}
