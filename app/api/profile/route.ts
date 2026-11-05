import { forward, jsonBody } from "@/lib/cv/server";

export async function GET(request: Request): Promise<Response> {
  return forward(request, { method: "GET", path: "/profile", ok: { 200: "json" } });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  return forward(request, {
    method: "PUT",
    path: "/profile",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    ok: { 204: "none" },
  });
}
