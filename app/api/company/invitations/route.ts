import { invitar, listarInvitaciones } from "@/lib/company/server";

export async function GET(request: Request): Promise<Response> {
  return listarInvitaciones(request);
}

export async function POST(request: Request): Promise<Response> {
  return invitar(request);
}
