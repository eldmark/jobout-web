import { crear, reenviar } from "@/lib/interviews/server";

export async function GET(request: Request): Promise<Response> {
  return reenviar(request, { method: "GET", path: "/interviews", ok: { 200: "json" } });
}

export async function POST(request: Request): Promise<Response> {
  return crear(request);
}
