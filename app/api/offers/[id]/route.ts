import { leerOferta } from "@/lib/offers/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return leerOferta(request, ctx.params);
}
