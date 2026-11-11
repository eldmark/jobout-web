import { listarEmpresasAdmin } from "@/lib/company/server";

export async function GET(request: Request): Promise<Response> {
  return listarEmpresasAdmin(request);
}
