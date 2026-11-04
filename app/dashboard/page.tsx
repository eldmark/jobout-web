import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardView, { type Me } from "@/app/_components/DashboardView";
import { ME_PATH } from "@/lib/api/client";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { backendUrl } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

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
    if (data && typeof data.first_name === "string" && data.plan) me = data as Me;
  }
  return <DashboardView me={me} />;
}
