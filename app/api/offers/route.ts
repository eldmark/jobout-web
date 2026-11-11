import { listarOfertas } from "@/lib/offers/server";

export async function GET(request: Request): Promise<Response> {
  return listarOfertas(request);
}
