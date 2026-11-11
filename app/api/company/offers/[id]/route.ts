import { borrarOferta, leerOferta, reemplazarOferta } from "@/lib/company/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return leerOferta(request, ctx.params);
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return reemplazarOferta(request, ctx.params);
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return borrarOferta(request, ctx.params);
}
