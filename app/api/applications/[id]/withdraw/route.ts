import { retirar } from "@/lib/offers/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return retirar(request, ctx.params);
}
