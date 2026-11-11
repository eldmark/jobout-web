import { fijarMembresia } from "@/lib/company/server";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return fijarMembresia(request, ctx.params);
}
