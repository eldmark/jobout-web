import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardView, { type Me } from "@/app/_components/DashboardView";
import { ME_PATH } from "@/lib/api/client";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { backendUrl } from "@/lib/auth/server";
import { parseRoles } from "@/lib/auth/menu";

export const dynamic = "force-dynamic";

/** true solo si SABEMOS que no hay CV ni skills; ante cualquier duda no se molesta a la persona. */
async function needsProfile(access: string): Promise<boolean> {
  try {
    const headers = { authorization: `Bearer ${access}` };
    const base = `${backendUrl()}/api/v1`;
    const [cvs, perfil] = await Promise.all([
      fetch(`${base}/cvs`, { headers, cache: "no-store" }),
      fetch(`${base}/profile`, { headers, cache: "no-store" }),
    ]);
    if (!cvs.ok || !perfil.ok) return false;
    const listaCvs: unknown = await cvs.json().catch(() => null);
    const datos: { skills?: unknown } | null = await perfil.json().catch(() => null);
    if (!Array.isArray(listaCvs) || !datos || !Array.isArray(datos.skills)) return false;
    return listaCvs.length === 0 && datos.skills.length === 0;
  } catch {
    return false;
  }
}

/** Id de la primera sesión con ese estado (el backend filtra por `status`); null ante cualquier duda. */
async function firstWithStatus(access: string, status: "in_progress" | "paused"): Promise<string | null> {
  try {
    const res = await fetch(`${backendUrl()}/api/v1/interviews?status=${status}&limit=1`, { headers: { authorization: `Bearer ${access}` }, cache: "no-store" });
    if (!res.ok) return null;
    const pagina: { items?: unknown } | null = await res.json().catch(() => null);
    if (!pagina || !Array.isArray(pagina.items)) return null;
    const primera = (pagina.items as { id?: unknown }[])[0];
    return primera && typeof primera.id === "string" ? primera.id : null;
  } catch {
    return null;
  }
}

/** Id de la entrevista en curso o, si no hay, en pausa; null si no hay ninguna o ante cualquier duda. */
async function activeInterview(access: string): Promise<string | null> {
  const [enCurso, enPausa] = await Promise.all([firstWithStatus(access, "in_progress"), firstWithStatus(access, "paused")]);
  return enCurso ?? enPausa;
}

/** Las páginas del servidor no pueden escribir cookies: si el access expiró, se redirige a
 * /api/auth/refresh, que renueva y vuelve aquí (`?refreshed=1` evita un bucle). */
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ refreshed?: string }>;
}) {
  const { refreshed } = await searchParams;
  const jar = await cookies();
  const access = jar.get(SESSION_COOKIE)?.value;
  if (!access) redirect("/api/auth/refresh");

  let res: Response | null = null;
  try {
    res = await fetch(`${backendUrl()}${ME_PATH}`, {
      headers: { authorization: `Bearer ${access}` },
      cache: "no-store",
    });
  } catch {
    res = null;
  }
  if (res?.status === 401) redirect(refreshed ? "/api/auth/refresh?fail=1" : "/api/auth/refresh");

  let me: Me | null = null;
  if (res?.ok) {
    const data: Partial<Me> | null = await res.json().catch(() => null);
    // Los roles eligen el menú (FC6); con otra forma, ninguno: nunca se inventa un rol.
    if (data && typeof data.first_name === "string" && data.plan) me = { ...(data as Me), roles: parseRoles(data.roles) };
  }
  const [completeProfile, activeInterviewId] = me ? await Promise.all([needsProfile(access), activeInterview(access)]) : [false, null];
  return <DashboardView me={me} completeProfile={completeProfile} activeInterviewId={activeInterviewId} />;
}
