import { aceptarInvitacion } from "@/lib/company/server";

export async function POST(request: Request): Promise<Response> {
  return aceptarInvitacion(request);
}
