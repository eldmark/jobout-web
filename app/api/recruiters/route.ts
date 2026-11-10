import { reenviar } from "@/lib/interviews/server";

export async function GET(request: Request): Promise<Response> {
  return reenviar(request, { method: "GET", path: "/recruiters", ok: { 200: "json" } });
}
