import { accion } from "@/lib/interviews/server";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return accion(request, ctx.params, "GET", "/score", { 200: "json" });
}
