import { leerAplicacion } from "@/lib/offers/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return leerAplicacion(request, ctx.params);
}
