import { marcarFavorito, quitarFavorito } from "@/lib/company/server";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return marcarFavorito(request, ctx.params);
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return quitarFavorito(request, ctx.params);
}
