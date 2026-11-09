import { enviarTurno } from "@/lib/interviews/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return enviarTurno(request, ctx.params);
}
