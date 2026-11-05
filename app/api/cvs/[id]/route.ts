import { forward, idParam, noEncontrado } from "@/lib/cv/server";

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = await idParam(ctx.params);
  if (!id) return noEncontrado();
  return forward(request, { method: "DELETE", path: `/cvs/${id}`, ok: { 204: "none" } });
}
