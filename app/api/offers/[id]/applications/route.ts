import { aplicar } from "@/lib/offers/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return aplicar(request, ctx.params);
}
