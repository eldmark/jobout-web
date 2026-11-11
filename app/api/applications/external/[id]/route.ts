import { borrarExterna, leerExterna, reemplazarExterna } from "@/lib/offers/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  return leerExterna(request, ctx.params);
}

export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  return reemplazarExterna(request, ctx.params);
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  return borrarExterna(request, ctx.params);
}
