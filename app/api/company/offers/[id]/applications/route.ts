import { listarPanel } from "@/lib/company/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return listarPanel(request, ctx.params);
}
