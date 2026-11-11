import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardView, { type Me } from "@/app/_components/DashboardView";
import { ME_PATH } from "@/lib/api/client";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { backendUrl } from "@/lib/auth/server";
import { parseRoles, showsCandidateBlocks } from "@/lib/auth/menu";
import { loadAdmin, loadCandidate, loadCompany, needsProfile } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

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
  const roles = me?.roles ?? [];
  const candidato = showsCandidateBlocks(roles);
  const deEmpresa = roles.includes("company_admin") || roles.includes("recruiter");
  const [candidate, activeInterviewId, company, admin] = me
    ? await Promise.all([
        candidato ? loadCandidate(access) : null,
        candidato ? activeInterview(access) : null,
        deEmpresa ? loadCompany(access) : null,
        roles.includes("admin") ? loadAdmin(access) : null,
      ])
    : [null, null, null, null];
  const completeProfile = candidate ? needsProfile(candidate) : false;
  return <DashboardView me={me} completeProfile={completeProfile} activeInterviewId={activeInterviewId} candidate={candidate} company={company} admin={admin} nowIso={new Date().toISOString()} />;
}
