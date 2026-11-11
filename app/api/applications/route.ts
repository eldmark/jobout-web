import { listarAplicaciones } from "@/lib/offers/server";

export async function GET(request: Request): Promise<Response> {
  return listarAplicaciones(request);
}
