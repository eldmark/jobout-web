import { accion } from "@/lib/interviews/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  return accion(request, ctx.params, "GET", "", { 200: "json" });
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  return accion(request, ctx.params, "DELETE", "", { 204: "none" });
}
