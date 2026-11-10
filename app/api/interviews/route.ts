import { crear, listar } from "@/lib/interviews/server";

export async function GET(request: Request): Promise<Response> {
  return listar(request);
}

export async function POST(request: Request): Promise<Response> {
  return crear(request);
}
