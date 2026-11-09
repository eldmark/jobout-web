import { forward, idParam, noEncontrado } from "@/lib/cv/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = await idParam(ctx.params);
  if (!id) return noEncontrado();
  return forward(request, { method: "GET", path: `/cvs/${id}/extraction`, ok: { 200: "json" } });
}
