import { crearEmpresa, editarEmpresa, leerEmpresa } from "@/lib/company/server";

export async function GET(request: Request): Promise<Response> {
  return leerEmpresa(request);
}

export async function POST(request: Request): Promise<Response> {
  return crearEmpresa(request);
}

export async function PUT(request: Request): Promise<Response> {
  return editarEmpresa(request);
}
