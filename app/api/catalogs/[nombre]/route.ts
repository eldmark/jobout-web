import { CATALOGOS, forward, noEncontrado, UUID_RE } from "@/lib/cv/server";
import { errorJson } from "@/lib/auth/server";

export async function GET(request: Request, ctx: { params: Promise<{ nombre: string }> }): Promise<Response> {
  const { nombre } = await ctx.params;
  if (!(CATALOGOS as readonly string[]).includes(nombre)) return noEncontrado();
  // Los municipios se piden por departamento; es el único parámetro que viaja.
  const estado = nombre === "cities" ? new URL(request.url).searchParams.get("state_id") : null;
  if (estado !== null && !UUID_RE.test(estado)) return errorJson(422, "datos_invalidos");
  const query = estado ? `?state_id=${estado}` : "";
  return forward(request, { method: "GET", path: `/catalogs/${nombre}${query}`, ok: { 200: "json" } });
}
