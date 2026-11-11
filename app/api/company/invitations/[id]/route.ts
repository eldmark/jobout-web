import { revocarInvitacion } from "@/lib/company/server";

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return revocarInvitacion(request, ctx.params);
}
