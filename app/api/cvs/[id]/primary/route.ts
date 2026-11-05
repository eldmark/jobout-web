import { forward, idParam, noEncontrado } from "@/lib/cv/server";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = await idParam(ctx.params);
  if (!id) return noEncontrado();
  return forward(request, { method: "PUT", path: `/cvs/${id}/primary`, ok: { 204: "none" } });
}
