import { leerAplicacionPanel } from "@/lib/company/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return leerAplicacionPanel(request, ctx.params);
}
