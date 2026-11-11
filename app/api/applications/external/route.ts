import { crearExterna, listarExternas } from "@/lib/offers/server";

export async function GET(request: Request): Promise<Response> {
  return listarExternas(request);
}

export async function POST(request: Request): Promise<Response> {
  return crearExterna(request);
}
