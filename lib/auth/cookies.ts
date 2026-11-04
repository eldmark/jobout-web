/** F5: cookies de sesión. HttpOnly + Secure + SameSite=Lax. Nunca almacenamiento web. */
export const SESSION_COOKIE = "jo_session";
export const REFRESH_COOKIE = "jo_refresh";

const NAME = /^[A-Za-z0-9_-]+$/;

function attrs(maxAge: number): string {
  return ["Path=/", `Max-Age=${maxAge}`, "HttpOnly", "Secure", "SameSite=Lax"].join("; ");
}

function checkName(name: string) {
  if (!NAME.test(name)) throw new Error(`Nombre de cookie inválido: ${name}`);
}

/** Valor para una cabecera Set-Cookie. */
export function serializeSessionCookie(
  name: string,
  value: string,
  opts: { maxAgeSeconds: number },
): string {
  checkName(name);
  return `${name}=${encodeURIComponent(value)}; ${attrs(opts.maxAgeSeconds)}`;
}

export function clearSessionCookie(name: string): string {
  checkName(name);
  return `${name}=; ${attrs(0)}`;
}
