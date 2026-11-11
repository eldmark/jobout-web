import { verificar } from "@/lib/company/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return verificar(request, ctx.params);
}
