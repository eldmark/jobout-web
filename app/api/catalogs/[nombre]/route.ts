import { CATALOGOS, forward, noEncontrado } from "@/lib/cv/server";

export async function GET(request: Request, ctx: { params: Promise<{ nombre: string }> }): Promise<Response> {
  const { nombre } = await ctx.params;
  if (!(CATALOGOS as readonly string[]).includes(nombre)) return noEncontrado();
  return forward(request, { method: "GET", path: `/catalogs/${nombre}`, ok: { 200: "json" } });
}
