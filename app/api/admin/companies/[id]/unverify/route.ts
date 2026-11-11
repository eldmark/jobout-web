import { quitarVerificacion } from "@/lib/company/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return quitarVerificacion(request, ctx.params);
}
