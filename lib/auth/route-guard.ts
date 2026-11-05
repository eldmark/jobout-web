/** F1/F2: decisión de acceso por ruta. Función pura, sin Next ni cookies. */
export const SIGN_IN_PATH = "/sign-in";

export type RouteDecision = { action: "allow" } | { action: "redirect"; to: string };

/** Rutas públicas: coincidencia exacta o como carpeta (`/sign-in/...`), nunca por prefijo suelto. */
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/health", "/adios"] as const;
const PUBLIC_FOLDERS = ["/sign-in", "/sign-up", "/health", "/_next", "/api/auth"] as const;
/** Endpoints de CV/perfil: sin sesión responden 401 JSON ellos mismos (un redirect a HTML rompería el fetch). */
const SELF_GUARDED_FOLDERS = ["/api/cvs", "/api/profile", "/api/catalogs"] as const;
const PUBLIC_FILES = ["/favicon.ico", "/robots.txt"] as const;

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isPublicPath(pathname: string): boolean {
  const p = normalize(pathname);
  if ((PUBLIC_PATHS as readonly string[]).includes(p)) return true;
  if ((PUBLIC_FILES as readonly string[]).includes(p)) return true;
  if (SELF_GUARDED_FOLDERS.some((f) => p === f || p.startsWith(`${f}/`))) return true;
  return PUBLIC_FOLDERS.some((f) => p.startsWith(`${f}/`));
}

export function decideRoute(pathname: string, hasSession: boolean): RouteDecision {
  if (hasSession || isPublicPath(pathname)) return { action: "allow" };
  return { action: "redirect", to: SIGN_IN_PATH };
}
