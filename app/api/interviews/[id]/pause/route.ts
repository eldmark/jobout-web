import { accion } from "@/lib/interviews/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return accion(request, ctx.params, "POST", "/pause", { 204: "none" });
}
