import { crearOferta, listarOfertas } from "@/lib/company/server";

export async function GET(request: Request): Promise<Response> {
  return listarOfertas(request);
}

export async function POST(request: Request): Promise<Response> {
  return crearOferta(request);
}
